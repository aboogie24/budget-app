package categories

import "testing"

func TestNormalizeMerchant(t *testing.T) {
	cases := []struct {
		name     string
		raw      string
		clean    string
		expected string
	}{
		{"provider clean name preferred", "POS DEBIT GARBAGE 1234", "Blue Bottle Coffee", "blue bottle coffee"},
		{"clean name lowercased + collapsed", "", "Whole  Foods   Market", "whole foods market"},
		{"square prefix", "SQ *BLUE BOTTLE COFFEE", "", "blue bottle coffee"},
		{"toast prefix + store number", "TST* CHIPOTLE 0481", "", "chipotle"},
		{"pos debit + store number + state", "POS DEBIT STARBUCKS #1234 SEATTLE WA", "", "starbucks seattle"},
		{"purchase-authorized prefix + date", "Purchase authorized on 04/21 TRADER JOES", "", "trader joes"},
		{"checkcard prefix + phone + state", "CHECKCARD 0419 NETFLIX.COM 866-579-7172 CA", "", "netflix.com"},
		{"amazon ref code", "AMZN MKTP US*1A2B3C", "", "amzn mktp us"},
		{"stacked prefixes", "POS DEBIT SQ *PEET'S COFFEE", "", "peet's coffee"},
		{"plain merchant untouched", "COSTCO WHSE", "", "costco whse"},
		{"empty input", "", "", ""},
		{"ach prefix", "ACH DEBIT COMCAST CABLE", "", "comcast cable"},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := NormalizeMerchant(c.raw, c.clean)
			if got != c.expected {
				t.Errorf("NormalizeMerchant(%q, %q) = %q, want %q", c.raw, c.clean, got, c.expected)
			}
		})
	}
}

// TestNormalizeMerchantStable verifies the same merchant with varying noise
// (store numbers, dates) collapses to one stable key — the whole point.
func TestNormalizeMerchantStable(t *testing.T) {
	variants := []string{
		"TST* CHIPOTLE 0481",
		"TST* CHIPOTLE 0512",
		"TST*CHIPOTLE 1099",
	}
	want := "chipotle"
	for _, v := range variants {
		if got := NormalizeMerchant(v, ""); got != want {
			t.Errorf("NormalizeMerchant(%q) = %q, want %q", v, got, want)
		}
	}
}
