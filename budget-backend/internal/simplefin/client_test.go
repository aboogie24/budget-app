package simplefin

import (
	"encoding/base64"
	"strings"
	"testing"
	"time"
)

func TestClaimSetupToken_Validation(t *testing.T) {
	cases := []struct {
		name  string
		token string
		want  string
	}{
		{"empty", "", "empty"},
		{"not base64", "!!!not-base64!!!", "not valid base64"},
		{"decodes to non-https", base64.StdEncoding.EncodeToString([]byte("http://insecure.example/claim/x")), "https claim URL"},
		{"decodes to garbage", base64.StdEncoding.EncodeToString([]byte("not a url at all")), "https claim URL"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := ClaimSetupToken(tc.token)
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("expected error containing %q, got %v", tc.want, err)
			}
		})
	}
}

func TestInstitutionFor_BothProtocolShapes(t *testing.T) {
	// Older shape: org on the account.
	setOld := &AccountSet{}
	if got := setOld.InstitutionFor(Account{Org: Org{Name: "First Bank"}}); got != "First Bank" {
		t.Fatalf("org name: got %q", got)
	}
	if got := setOld.InstitutionFor(Account{Org: Org{Domain: "bank.example"}}); got != "bank.example" {
		t.Fatalf("org domain fallback: got %q", got)
	}

	// Newer shape: connections list keyed by conn_id.
	setNew := &AccountSet{Connections: []Connection{{ConnID: "c1", Name: "Second Bank"}}}
	if got := setNew.InstitutionFor(Account{ConnID: "c1"}); got != "Second Bank" {
		t.Fatalf("connection lookup: got %q", got)
	}

	// Nothing known → generic label.
	if got := setOld.InstitutionFor(Account{}); got != "SimpleFIN" {
		t.Fatalf("generic fallback: got %q", got)
	}
}

func TestFetchAccounts_QueryShape(t *testing.T) {
	// Malformed access URL should fail fast without a network call.
	if _, err := FetchAccounts("://bad", time.Now(), false); err == nil {
		t.Fatal("expected error for malformed access url")
	}
}
