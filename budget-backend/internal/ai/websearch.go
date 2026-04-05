package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"
)

// ─── Tavily API Client ───────────────────────────────────────

const tavilyAPIURL = "https://api.tavily.com/search"

var (
	tavilyClient     *TavilyClient
	tavilyClientOnce sync.Once
)

// TavilyClient wraps communication with the Tavily Search API.
type TavilyClient struct {
	apiKey     string
	httpClient *http.Client
	cache      *searchCache
	limiter    *rateLimiter
}

// GetTavilyClient returns the singleton Tavily client. Returns nil if no API key.
func GetTavilyClient() *TavilyClient {
	tavilyClientOnce.Do(func() {
		key := os.Getenv("TAVILY_API_KEY")
		if key == "" {
			log.Println("INFO: TAVILY_API_KEY not set — web search tool will be unavailable")
			return
		}
		tavilyClient = &TavilyClient{
			apiKey:     key,
			httpClient: &http.Client{Timeout: 15 * time.Second},
			cache:      newSearchCache(15 * time.Minute),
			limiter:    newRateLimiter(30), // 30 searches per user per day
		}
		log.Println("Tavily web search client initialized")
	})
	return tavilyClient
}

// IsWebSearchAvailable returns true if the Tavily API key is configured.
func IsWebSearchAvailable() bool {
	return GetTavilyClient() != nil
}

// ─── Tavily API Types ─────────────────────────────────────────

type tavilyRequest struct {
	APIKey        string `json:"api_key"`
	Query         string `json:"query"`
	MaxResults    int    `json:"max_results"`
	SearchDepth   string `json:"search_depth"`
	IncludeAnswer bool   `json:"include_answer"`
}

// TavilyResult represents a single search result.
type TavilyResult struct {
	Title   string  `json:"title"`
	URL     string  `json:"url"`
	Content string  `json:"content"`
	Score   float64 `json:"score"`
}

// TavilyResponse is the response from the Tavily Search API.
type TavilyResponse struct {
	Answer  string         `json:"answer"`
	Results []TavilyResult `json:"results"`
}

// Search calls the Tavily API and returns structured results.
func (c *TavilyClient) Search(query string, maxResults int) (*TavilyResponse, error) {
	if maxResults <= 0 || maxResults > 10 {
		maxResults = 5
	}

	reqBody := tavilyRequest{
		APIKey:        c.apiKey,
		Query:         query,
		MaxResults:    maxResults,
		SearchDepth:   "basic",
		IncludeAnswer: true,
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal tavily request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", tavilyAPIURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create tavily request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("tavily request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("tavily API error %d: %s", resp.StatusCode, string(respBody))
	}

	var tavilyResp TavilyResponse
	if err := json.NewDecoder(resp.Body).Decode(&tavilyResp); err != nil {
		return nil, fmt.Errorf("decode tavily response: %w", err)
	}

	return &tavilyResp, nil
}

// ─── Tool Executor ────────────────────────────────────────────

// executeWebSearch is the tool executor called from ExecuteTool.
func executeWebSearch(userID string, input json.RawMessage) (string, error) {
	client := GetTavilyClient()
	if client == nil {
		return `{"error": "Web search is not available — TAVILY_API_KEY not configured"}`, nil
	}

	// Parse input
	var params struct {
		Query      string `json:"query"`
		MaxResults int    `json:"max_results"`
	}
	if err := json.Unmarshal(input, &params); err != nil {
		return `{"error": "Invalid search parameters"}`, nil
	}
	if params.Query == "" {
		return `{"error": "Search query is required"}`, nil
	}
	if params.MaxResults <= 0 {
		params.MaxResults = 5
	}

	// Rate limit check
	if !client.limiter.allow(userID) {
		return `{"error": "Search rate limit reached (30 per day). Try again tomorrow."}`, nil
	}

	// Check cache
	cacheKey := strings.ToLower(strings.TrimSpace(params.Query))
	if cached, ok := client.cache.get(cacheKey); ok {
		log.Printf("web_search: cache hit user=%s query=%q", userID, params.Query)
		return cached, nil
	}

	// Call Tavily API
	log.Printf("web_search: user=%s query=%q max_results=%d", userID, params.Query, params.MaxResults)
	resp, err := client.Search(params.Query, params.MaxResults)
	if err != nil {
		log.Printf("web_search: error: %v", err)
		return fmt.Sprintf(`{"error": "Search failed: %s"}`, err.Error()), nil
	}

	// Format results for Claude
	result := map[string]interface{}{
		"answer":  resp.Answer,
		"results": resp.Results,
	}
	resultJSON, _ := json.Marshal(result)
	resultStr := string(resultJSON)

	// Cache the result
	client.cache.set(cacheKey, resultStr)

	return resultStr, nil
}

// ─── In-Memory Cache ──────────────────────────────────────────

type searchCache struct {
	mu      sync.RWMutex
	entries map[string]cachedResult
	ttl     time.Duration
}

type cachedResult struct {
	result    string
	expiresAt time.Time
}

func newSearchCache(ttl time.Duration) *searchCache {
	c := &searchCache{
		entries: make(map[string]cachedResult),
		ttl:     ttl,
	}
	// Background cleanup every 5 minutes
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			c.cleanup()
		}
	}()
	return c
}

func (c *searchCache) get(key string) (string, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	entry, ok := c.entries[key]
	if !ok || time.Now().After(entry.expiresAt) {
		return "", false
	}
	return entry.result, true
}

func (c *searchCache) set(key, result string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[key] = cachedResult{
		result:    result,
		expiresAt: time.Now().Add(c.ttl),
	}
}

func (c *searchCache) cleanup() {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := time.Now()
	for k, v := range c.entries {
		if now.After(v.expiresAt) {
			delete(c.entries, k)
		}
	}
}

// ─── Per-User Rate Limiter ────────────────────────────────────

type rateLimiter struct {
	mu         sync.Mutex
	daily      map[string][]time.Time
	maxPerDay  int
}

func newRateLimiter(maxPerDay int) *rateLimiter {
	return &rateLimiter{
		daily:     make(map[string][]time.Time),
		maxPerDay: maxPerDay,
	}
}

func (r *rateLimiter) allow(userID string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-24 * time.Hour)

	// Clean old entries
	timestamps := r.daily[userID]
	var recent []time.Time
	for _, t := range timestamps {
		if t.After(cutoff) {
			recent = append(recent, t)
		}
	}

	if len(recent) >= r.maxPerDay {
		r.daily[userID] = recent
		return false
	}

	r.daily[userID] = append(recent, now)
	return true
}
