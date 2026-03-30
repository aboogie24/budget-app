package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// ZillowResult holds the scraped property data.
type ZillowResult struct {
	Zestimate float64 `json:"zestimate"`
	ZillowURL string  `json:"zillow_url"`
	ZPID      string  `json:"zpid"`
	Error     string  `json:"error,omitempty"`
}

var zillowHTTPClient *http.Client

func init() {
	jar, _ := cookiejar.New(nil)
	zillowHTTPClient = &http.Client{
		Timeout: 20 * time.Second,
		Jar:     jar,
	}
}

// FetchZestimate retrieves the Zestimate for a property at the given address.
// It tries multiple strategies: autocomplete API → property detail page → search page scraping.
func FetchZestimate(street, city, state, zip string) (*ZillowResult, error) {
	// Strategy 1: Use Zillow autocomplete API to get ZPID, then fetch property detail page
	if result, err := fetchViaAutocomplete(street, city, state, zip); err == nil && result.Zestimate > 0 {
		return result, nil
	} else if err != nil {
		log.Printf("zillow: autocomplete strategy failed: %v", err)
	}

	// Strategy 2: Direct search URL scraping with improved headers
	searchURL := constructZillowSearchURL(street, city, state, zip)
	log.Printf("zillow: fallback - fetching search page %s", searchURL)

	body, err := fetchZillowPage(searchURL)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch Zillow page: %w", err)
	}

	result, err := extractZestimateFromHTML(body)
	if err != nil {
		return &ZillowResult{
			ZillowURL: searchURL,
			Error:     err.Error(),
		}, err
	}

	result.ZillowURL = searchURL
	if result.ZPID != "" {
		addrSlug := slugify(street + " " + city + " " + state + " " + zip)
		result.ZillowURL = fmt.Sprintf("https://www.zillow.com/homedetails/%s/%s_zpid/", addrSlug, result.ZPID)
	}

	return result, nil
}

type autocompleteResponse struct {
	Results []struct {
		Display  string `json:"display"`
		MetaData struct {
			ZPID string `json:"zpid"`
		} `json:"metaData"`
	} `json:"results"`
}

// fetchViaAutocomplete uses Zillow's CDN-hosted autocomplete API to find the
// property ZPID, then fetches the property detail page to extract the Zestimate.
// The autocomplete endpoint is on zillowstatic.com (CDN) and has much less
// aggressive bot protection than zillow.com pages.
func fetchViaAutocomplete(street, city, state, zip string) (*ZillowResult, error) {
	query := street + ", " + city + ", " + state + " " + zip
	apiURL := "https://www.zillowstatic.com/autocomplete/v3/suggestions?q=" + url.QueryEscape(query)

	log.Printf("zillow: autocomplete query: %s", query)

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "*/*")
	req.Header.Set("Referer", "https://www.zillow.com/")
	req.Header.Set("Origin", "https://www.zillow.com")

	resp, err := zillowHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("autocomplete returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var ac autocompleteResponse
	if err := json.Unmarshal(body, &ac); err != nil {
		return nil, fmt.Errorf("autocomplete parse error: %w", err)
	}

	if len(ac.Results) == 0 {
		return nil, fmt.Errorf("no autocomplete results for: %s", query)
	}

	zpid := ac.Results[0].MetaData.ZPID
	if zpid == "" {
		return nil, fmt.Errorf("no zpid in autocomplete result")
	}

	log.Printf("zillow: autocomplete found zpid=%s display=%s", zpid, ac.Results[0].Display)

	// Fetch the property detail page using the ZPID (detail pages are less
	// likely to be blocked than search result pages)
	addrSlug := slugify(street + " " + city + " " + state + " " + zip)
	detailURL := fmt.Sprintf("https://www.zillow.com/homedetails/%s/%s_zpid/", addrSlug, zpid)

	log.Printf("zillow: fetching detail page %s", detailURL)

	pageBody, err := fetchZillowPage(detailURL)
	if err != nil {
		// Page fetch failed but we still have ZPID and URL — return partial result
		log.Printf("zillow: detail page fetch failed: %v", err)
		return &ZillowResult{
			ZPID:      zpid,
			ZillowURL: detailURL,
			Error:     err.Error(),
		}, fmt.Errorf("detail page fetch failed (zpid=%s): %w", zpid, err)
	}

	result, err := extractZestimateFromHTML(pageBody)
	if err != nil {
		return &ZillowResult{
			ZPID:      zpid,
			ZillowURL: detailURL,
			Error:     err.Error(),
		}, err
	}

	result.ZPID = zpid
	result.ZillowURL = detailURL
	return result, nil
}

func constructZillowSearchURL(street, city, state, zip string) string {
	slug := strings.Join([]string{
		slugify(street),
		slugify(city),
		strings.ToUpper(strings.TrimSpace(state)),
		strings.TrimSpace(zip),
	}, "-")
	return fmt.Sprintf("https://www.zillow.com/homes/%s_rb/", slug)
}

func slugify(s string) string {
	s = strings.TrimSpace(s)
	re := regexp.MustCompile(`[^a-zA-Z0-9]+`)
	s = re.ReplaceAllString(s, "-")
	return strings.Trim(s, "-")
}

// setBrowserHeaders adds comprehensive browser-like headers to avoid bot detection.
func setBrowserHeaders(req *http.Request) {
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")
	req.Header.Set("Cache-Control", "no-cache")
	req.Header.Set("Pragma", "no-cache")
	req.Header.Set("Sec-Ch-Ua", `"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"`)
	req.Header.Set("Sec-Ch-Ua-Mobile", "?0")
	req.Header.Set("Sec-Ch-Ua-Platform", `"macOS"`)
	req.Header.Set("Sec-Fetch-Dest", "document")
	req.Header.Set("Sec-Fetch-Mode", "navigate")
	req.Header.Set("Sec-Fetch-Site", "none")
	req.Header.Set("Sec-Fetch-User", "?1")
	req.Header.Set("Upgrade-Insecure-Requests", "1")
}

func fetchZillowPage(pageURL string) ([]byte, error) {
	req, err := http.NewRequest("GET", pageURL, nil)
	if err != nil {
		return nil, err
	}
	setBrowserHeaders(req)

	resp, err := zillowHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("zillow returned status %d", resp.StatusCode)
	}

	return io.ReadAll(resp.Body)
}

// extractZestimateFromHTML tries multiple strategies to extract the Zestimate.
func extractZestimateFromHTML(htmlBody []byte) (*ZillowResult, error) {
	bodyStr := string(htmlBody)

	// Strategy 1: __NEXT_DATA__ JSON
	if result, err := extractFromNextData(bodyStr); err == nil && result.Zestimate > 0 {
		return result, nil
	}

	// Strategy 2: hdpApolloPreloadedData
	if result, err := extractFromApolloCache(bodyStr); err == nil && result.Zestimate > 0 {
		return result, nil
	}

	// Strategy 3: Regex fallback
	if result, err := extractFromRegex(bodyStr); err == nil && result.Zestimate > 0 {
		return result, nil
	}

	return nil, fmt.Errorf("could not extract Zestimate from page")
}

func extractFromNextData(body string) (*ZillowResult, error) {
	re := regexp.MustCompile(`<script id="__NEXT_DATA__"[^>]*>(.*?)</script>`)
	matches := re.FindStringSubmatch(body)
	if len(matches) < 2 {
		return nil, fmt.Errorf("__NEXT_DATA__ not found")
	}

	var nextData map[string]interface{}
	if err := json.Unmarshal([]byte(matches[1]), &nextData); err != nil {
		return nil, err
	}

	// Navigate: props -> pageProps -> componentProps -> gdpClientCache
	cacheRaw := navigateJSON(nextData, "props", "pageProps", "componentProps", "gdpClientCache")
	if cacheRaw == nil {
		// Try alternate path: props -> pageProps -> gdpClientCache
		cacheRaw = navigateJSON(nextData, "props", "pageProps", "gdpClientCache")
	}
	if cacheRaw == nil {
		return nil, fmt.Errorf("gdpClientCache not found")
	}

	// gdpClientCache is often a JSON string that needs double-parsing
	var cache map[string]interface{}
	switch v := cacheRaw.(type) {
	case string:
		if err := json.Unmarshal([]byte(v), &cache); err != nil {
			return nil, err
		}
	case map[string]interface{}:
		cache = v
	default:
		return nil, fmt.Errorf("unexpected gdpClientCache type")
	}

	for _, v := range cache {
		vMap, ok := v.(map[string]interface{})
		if !ok {
			continue
		}
		property, ok := vMap["property"].(map[string]interface{})
		if !ok {
			continue
		}

		result := &ZillowResult{}
		if z, ok := property["zestimate"].(float64); ok {
			result.Zestimate = z
		}
		if zpid, ok := property["zpid"].(float64); ok {
			result.ZPID = fmt.Sprintf("%.0f", zpid)
		} else if zpid, ok := property["zpid"].(string); ok {
			result.ZPID = zpid
		}
		if result.Zestimate > 0 {
			return result, nil
		}
	}

	return nil, fmt.Errorf("no zestimate in gdpClientCache")
}

func extractFromApolloCache(body string) (*ZillowResult, error) {
	re := regexp.MustCompile(`<script id="hdpApolloPreloadedData"[^>]*>(.*?)</script>`)
	matches := re.FindStringSubmatch(body)
	if len(matches) < 2 {
		return nil, fmt.Errorf("hdpApolloPreloadedData not found")
	}

	var wrapper map[string]interface{}
	if err := json.Unmarshal([]byte(matches[1]), &wrapper); err != nil {
		return nil, err
	}

	apiCacheRaw, ok := wrapper["apiCache"]
	if !ok {
		return nil, fmt.Errorf("apiCache not found")
	}

	var apiCache map[string]interface{}
	switch v := apiCacheRaw.(type) {
	case string:
		if err := json.Unmarshal([]byte(v), &apiCache); err != nil {
			return nil, err
		}
	case map[string]interface{}:
		apiCache = v
	default:
		return nil, fmt.Errorf("unexpected apiCache type")
	}

	for _, v := range apiCache {
		vMap, ok := v.(map[string]interface{})
		if !ok {
			continue
		}
		property, ok := vMap["property"].(map[string]interface{})
		if !ok {
			continue
		}
		result := &ZillowResult{}
		if z, ok := property["zestimate"].(float64); ok {
			result.Zestimate = z
		}
		if zpid, ok := property["zpid"].(float64); ok {
			result.ZPID = fmt.Sprintf("%.0f", zpid)
		} else if zpid, ok := property["zpid"].(string); ok {
			result.ZPID = zpid
		}
		if result.Zestimate > 0 {
			return result, nil
		}
	}

	return nil, fmt.Errorf("no zestimate in apollo cache")
}

func extractFromRegex(body string) (*ZillowResult, error) {
	// Look for "zestimate":123456 pattern anywhere in the page
	re := regexp.MustCompile(`"zestimate"\s*:\s*(\d+)`)
	matches := re.FindStringSubmatch(body)
	if len(matches) < 2 {
		return nil, fmt.Errorf("zestimate regex not matched")
	}

	val, err := strconv.ParseFloat(matches[1], 64)
	if err != nil {
		return nil, err
	}

	result := &ZillowResult{Zestimate: val}

	// Try to extract zpid too
	zpidRe := regexp.MustCompile(`"zpid"\s*:\s*"?(\d+)"?`)
	zpidMatches := zpidRe.FindStringSubmatch(body)
	if len(zpidMatches) >= 2 {
		result.ZPID = zpidMatches[1]
	}

	return result, nil
}

// navigateJSON traverses a nested map by sequential string keys.
func navigateJSON(data map[string]interface{}, keys ...string) interface{} {
	var current interface{} = data
	for _, key := range keys {
		m, ok := current.(map[string]interface{})
		if !ok {
			return nil
		}
		current = m[key]
	}
	return current
}
