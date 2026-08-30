package handlers

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestAudAllowed(t *testing.T) {
	cases := []struct {
		aud, configured string
		want            bool
	}{
		{"anything", "", true},           // unset config disables the check
		{"anything", "   ", true},        // blank config disables the check
		{"a", "a", true},                 // single match
		{"b", "a", false},                // single mismatch
		{"b", "a,b,c", true},             // list match
		{"d", "a,b,c", false},            // list mismatch
		{"b", " a , b , c ", true},       // whitespace tolerated
		{"", "a,b", false},               // empty aud never matches a config
		{"a", ",,a,", true},              // stray commas ignored
	}
	for _, c := range cases {
		if got := audAllowed(c.aud, c.configured); got != c.want {
			t.Errorf("audAllowed(%q, %q) = %v, want %v", c.aud, c.configured, got, c.want)
		}
	}
}

// appleTestEnv serves a JWKS for a fresh RSA key and points the verifier at
// it. Returns the signing key; cleanup restores globals.
func appleTestEnv(t *testing.T, kid string) *rsa.PrivateKey {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("generate key: %v", err)
	}

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{
			"keys": []map[string]string{{
				"kty": "RSA",
				"kid": kid,
				"alg": "RS256",
				"use": "sig",
				"n":   base64.RawURLEncoding.EncodeToString(key.PublicKey.N.Bytes()),
				"e":   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.PublicKey.E)).Bytes()),
			}},
		})
	}))

	oldURL := appleJWKSURL
	appleJWKSURL = srv.URL
	appleKeys = appleKeyCache{} // reset cache so this test's JWKS is fetched
	t.Cleanup(func() {
		appleJWKSURL = oldURL
		appleKeys = appleKeyCache{}
		srv.Close()
	})
	return key
}

func signAppleToken(t *testing.T, key *rsa.PrivateKey, kid string, claims jwt.MapClaims) string {
	t.Helper()
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tok.Header["kid"] = kid
	s, err := tok.SignedString(key)
	if err != nil {
		t.Fatalf("sign token: %v", err)
	}
	return s
}

func validAppleClaims() jwt.MapClaims {
	return jwt.MapClaims{
		"iss":   "https://appleid.apple.com",
		"sub":   "001234.abcdef",
		"aud":   "com.github.aboogie.budgetapp",
		"email": "user@example.com",
		"exp":   time.Now().Add(time.Hour).Unix(),
		"iat":   time.Now().Unix(),
	}
}

func TestVerifyAppleToken_Valid(t *testing.T) {
	key := appleTestEnv(t, "test-key")
	tokenStr := signAppleToken(t, key, "test-key", validAppleClaims())

	claims, err := verifyAppleToken(tokenStr)
	if err != nil {
		t.Fatalf("expected valid token, got error: %v", err)
	}
	if claims.Sub != "001234.abcdef" || claims.Email != "user@example.com" {
		t.Fatalf("unexpected claims: %+v", claims)
	}
}

func TestVerifyAppleToken_BadSignature(t *testing.T) {
	appleTestEnv(t, "test-key")
	// Signed by a DIFFERENT key than the one in the JWKS, same kid.
	rogue, _ := rsa.GenerateKey(rand.Reader, 2048)
	tokenStr := signAppleToken(t, rogue, "test-key", validAppleClaims())

	if _, err := verifyAppleToken(tokenStr); err == nil {
		t.Fatal("expected signature verification to fail")
	}
}

func TestVerifyAppleToken_UnsignedRejected(t *testing.T) {
	appleTestEnv(t, "test-key")
	// alg=none style forgery: the pre-fix decoder accepted this shape.
	tok := jwt.NewWithClaims(jwt.SigningMethodNone, validAppleClaims())
	tok.Header["kid"] = "test-key"
	s, err := tok.SignedString(jwt.UnsafeAllowNoneSignatureType)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	if _, err := verifyAppleToken(s); err == nil {
		t.Fatal("expected unsigned token to be rejected")
	}
}

func TestVerifyAppleToken_Expired(t *testing.T) {
	key := appleTestEnv(t, "test-key")
	claims := validAppleClaims()
	claims["exp"] = time.Now().Add(-time.Hour).Unix()
	tokenStr := signAppleToken(t, key, "test-key", claims)

	if _, err := verifyAppleToken(tokenStr); err == nil {
		t.Fatal("expected expired token to be rejected")
	}
}

func TestVerifyAppleToken_WrongIssuer(t *testing.T) {
	key := appleTestEnv(t, "test-key")
	claims := validAppleClaims()
	claims["iss"] = "https://evil.example.com"
	tokenStr := signAppleToken(t, key, "test-key", claims)

	if _, err := verifyAppleToken(tokenStr); err == nil {
		t.Fatal("expected wrong issuer to be rejected")
	}
}

func TestVerifyAppleToken_AudienceMismatch(t *testing.T) {
	key := appleTestEnv(t, "test-key")
	t.Setenv("APPLE_BUNDLE_ID", "com.github.aboogie.budgetapp")

	claims := validAppleClaims()
	claims["aud"] = "com.other.app"
	tokenStr := signAppleToken(t, key, "test-key", claims)
	if _, err := verifyAppleToken(tokenStr); err == nil {
		t.Fatal("expected audience mismatch to be rejected")
	}

	// Matching audience passes.
	if _, err := verifyAppleToken(signAppleToken(t, key, "test-key", validAppleClaims())); err != nil {
		t.Fatalf("expected matching audience to pass, got %v", err)
	}
}

func TestVerifyAppleToken_UnknownKid(t *testing.T) {
	key := appleTestEnv(t, "test-key")
	tokenStr := signAppleToken(t, key, "other-key", validAppleClaims())

	if _, err := verifyAppleToken(tokenStr); err == nil {
		t.Fatal("expected unknown kid to be rejected")
	}
}
