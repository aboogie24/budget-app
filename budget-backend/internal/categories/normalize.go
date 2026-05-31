package categories

import (
	"regexp"
	"strings"
)

var (
	// Card-processor prefixes are a short code immediately followed by an
	// asterisk: "SQ *", "TST*", "SP *", "PYPL *".
	processorPrefixRe = regexp.MustCompile(`(?i)^[a-z0-9]{2,8}\s*\*+\s*`)

	// Bank / network prefixes that wrap the real merchant name.
	bankPrefixRe = regexp.MustCompile(`(?i)^(pos debit|pos|debit card purchase|debit purchase|purchase authorized on \d{1,2}/\d{1,2}(/\d{2,4})?|card purchase|checkcard(\s+\d+)?|check card|ach debit|ach credit|ach|recurring payment|recurring|external withdrawal|withdrawal|external deposit|preauthorized|pre-auth|visa|mastercard)\b[\s:*#-]*`)

	starRefRe  = regexp.MustCompile(`\*\w*\d\w*`) // "*1a2b3c" — ref code after an asterisk
	storeNumRe = regexp.MustCompile(`#\s*\d+`)    // "#1234"
	dateRe     = regexp.MustCompile(`\b\d{1,2}/\d{1,2}(/\d{2,4})?\b`)
	phoneRe    = regexp.MustCompile(`\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b`)
	refTokenRe = regexp.MustCompile(`\b[a-z]*\d{3,}[a-z0-9]*\b`) // store ids / refs with 3+ digits
	punctRe    = regexp.MustCompile(`[*#]+`)
	spaceRe    = regexp.MustCompile(`\s+`)
)

// usStateAbbrevs is used to drop a trailing "... CITY ST" state code.
var usStateAbbrevs = map[string]bool{
	"al": true, "ak": true, "az": true, "ar": true, "ca": true, "co": true,
	"ct": true, "de": true, "fl": true, "ga": true, "hi": true, "id": true,
	"il": true, "in": true, "ia": true, "ks": true, "ky": true, "la": true,
	"me": true, "md": true, "ma": true, "mi": true, "mn": true, "ms": true,
	"mo": true, "mt": true, "ne": true, "nv": true, "nh": true, "nj": true,
	"nm": true, "ny": true, "nc": true, "nd": true, "oh": true, "ok": true,
	"or": true, "pa": true, "ri": true, "sc": true, "sd": true, "tn": true,
	"tx": true, "ut": true, "vt": true, "va": true, "wa": true, "wv": true,
	"wi": true, "wy": true, "dc": true,
}

// NormalizeMerchant reduces a transaction description to a canonical merchant
// key used for rule matching and the learning loop.
//
// When a provider supplies an already-cleaned merchant name (Teller's
// counterparty.name, Plaid's merchant_name) it is preferred and only
// lowercased/whitespace-collapsed. Otherwise the raw bank description is
// stripped of card-network prefixes, store numbers, dates, phone numbers and
// reference codes so the same merchant yields a stable key across transactions.
func NormalizeMerchant(rawDescription, providerCleanName string) string {
	if clean := strings.TrimSpace(providerCleanName); clean != "" {
		return strings.TrimSpace(spaceRe.ReplaceAllString(strings.ToLower(clean), " "))
	}

	s := strings.ToLower(strings.TrimSpace(rawDescription))
	if s == "" {
		return ""
	}

	// Strip leading prefixes, which can stack (e.g. "POS DEBIT SQ *MERCHANT").
	for i := 0; i < 4; i++ {
		before := s
		s = strings.TrimSpace(processorPrefixRe.ReplaceAllString(s, ""))
		s = strings.TrimSpace(bankPrefixRe.ReplaceAllString(s, ""))
		if s == before {
			break
		}
	}

	s = phoneRe.ReplaceAllString(s, " ")
	s = starRefRe.ReplaceAllString(s, " ")
	s = storeNumRe.ReplaceAllString(s, " ")
	s = dateRe.ReplaceAllString(s, " ")
	s = refTokenRe.ReplaceAllString(s, " ")
	s = punctRe.ReplaceAllString(s, " ")
	s = strings.TrimSpace(spaceRe.ReplaceAllString(s, " "))

	// Drop a trailing US state abbreviation ("... seattle wa").
	fields := strings.Fields(s)
	if len(fields) > 1 && usStateAbbrevs[fields[len(fields)-1]] {
		fields = fields[:len(fields)-1]
	}
	return strings.Join(fields, " ")
}
