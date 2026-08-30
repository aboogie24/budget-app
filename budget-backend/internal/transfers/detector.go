// Package transfers detects internal account transfers — inflows that have a
// matching outflow in another of the user's bank-synced accounts on the same
// (or adjacent) day. Both sides get flipped to type='transfer' and linked via
// transactions.transfer_pair_id so calendar/budget aggregations can exclude
// them from income/expense sums.
package transfers

import (
	"database/sql"
	"fmt"
	"math"
	"strings"
	"time"
)

// candidate is one unpaired row eligible for pairing.
type candidate struct {
	id           string
	amount       float64
	date         time.Time
	merchantNorm string
	note         string
	// accountKey identifies which bank account the row came from, when the
	// provider encodes it (SimpleFIN external_id is "accountID:txID"). A
	// transfer's two sides live in DIFFERENT accounts — requiring distinct
	// keys stops a same-account refund from pairing with an unrelated,
	// coincidentally equal charge.
	accountKey string
}

// transferKeywords mark a note as describing an internal transfer/payment.
// Matching on these lets us pair rows whose merchant_normalized differs but
// that are obviously two sides of the same money movement (e.g. "OD ADVANCE
// TRANSFER OUT" vs "OD ADVANCE TRANSFER IN").
var transferKeywords = []string{"transfer", "payment", "wire", " ach "}

func hasTransferKeyword(note string) bool {
	n := " " + strings.ToLower(note) + " "
	for _, k := range transferKeywords {
		if strings.Contains(n, k) {
			return true
		}
	}
	return false
}

// matchable reports whether two rows can be paired: amounts match within $0.01,
// dates within ±1 day, AND they share enough merchant/keyword signal to avoid
// pairing two coincidentally same-amount rows that are unrelated (e.g. a
// USAA TRANSFER CR and a CASH APP charge that both happen to be $200).
func matchable(in, out candidate) bool {
	if math.Abs(in.amount-out.amount) > 0.01 {
		return false
	}
	if math.Abs(in.date.Sub(out.date).Hours()/24) > 1.0 {
		return false
	}
	// Two sides of a transfer live in different accounts — when both rows
	// carry an account identity, same-account pairs are refund/charge noise.
	if in.accountKey != "" && out.accountKey != "" && in.accountKey == out.accountKey {
		return false
	}
	// Strong signal: same normalized merchant.
	if in.merchantNorm != "" && in.merchantNorm == out.merchantNorm {
		return true
	}
	// Weaker but still good: both sides describe a transfer/payment/wire.
	return hasTransferKeyword(in.note) && hasTransferKeyword(out.note)
}

// DetectPairs runs the pairing heuristic for one user. Returns the number of
// pairs created (so pairsCreated*2 rows were updated).
//
// Heuristic:
//   - Pair an inflow (income | transfer) with an outflow (expense) when:
//     amount matches within $0.01 AND dates are within ±1 day AND neither row
//     is already paired.
//   - For each inflow, greedily pick the unpaired outflow with the smallest
//     date delta. Same-day pairs win over next-day. Ties broken by which
//     unpaired outflow comes first in date order.
//
// Limitations:
//   - Only bank-synced rows (source IN ('teller','bank','flinks','simplefin'))
//     — manual entries are excluded; the user types those themselves.
//   - Only sees one side if the other account isn't linked.
func DetectPairs(conn *sql.DB, userID string) (int, error) {
	inflows, err := loadCandidates(conn, userID, `type IN ('income','transfer')`)
	if err != nil {
		return 0, fmt.Errorf("load inflows: %w", err)
	}
	outflows, err := loadCandidates(conn, userID, `type = 'expense'`)
	if err != nil {
		return 0, fmt.Errorf("load outflows: %w", err)
	}
	if len(inflows) == 0 || len(outflows) == 0 {
		return 0, nil
	}

	// Greedy assignment: for each inflow in date order, pick the unpaired
	// outflow with the smallest date delta within the ±1 day window.
	used := make(map[int]bool, len(outflows))
	type pair struct{ inID, outID string }
	var pairs []pair

	for _, in := range inflows {
		bestIdx := -1
		bestDelta := math.MaxFloat64
		for i, out := range outflows {
			if used[i] {
				continue
			}
			if !matchable(in, out) {
				continue
			}
			deltaDays := math.Abs(in.date.Sub(out.date).Hours() / 24)
			if deltaDays < bestDelta {
				bestDelta = deltaDays
				bestIdx = i
			}
		}
		if bestIdx >= 0 {
			used[bestIdx] = true
			pairs = append(pairs, pair{inID: in.id, outID: outflows[bestIdx].id})
		}
	}

	// Apply the updates inside a transaction so partial pairing doesn't leave
	// orphaned transfer_pair_id values on one side.
	tx, err := conn.Begin()
	if err != nil {
		return 0, fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback() //nolint:errcheck

	stmt, err := tx.Prepare(`
		UPDATE transactions
		SET type = 'transfer', transfer_pair_id = $1, updated_at = NOW()
		WHERE id = $2
	`)
	if err != nil {
		return 0, fmt.Errorf("prepare: %w", err)
	}
	defer stmt.Close()

	for _, p := range pairs {
		if _, err := stmt.Exec(p.outID, p.inID); err != nil {
			return 0, fmt.Errorf("update inflow %s: %w", p.inID, err)
		}
		if _, err := stmt.Exec(p.inID, p.outID); err != nil {
			return 0, fmt.Errorf("update outflow %s: %w", p.outID, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("commit: %w", err)
	}
	return len(pairs), nil
}

// loadCandidates pulls unpaired bank-synced rows matching the type predicate,
// ordered by date so the greedy walk produces deterministic pairings.
func loadCandidates(conn *sql.DB, userID, typePred string) ([]candidate, error) {
	q := `
		SELECT id, amount, date, COALESCE(merchant_normalized,''), COALESCE(note,''),
		       CASE WHEN source = 'simplefin' THEN split_part(COALESCE(external_id,''), ':', 1) ELSE '' END
		FROM transactions
		WHERE user_id = $1
		  AND source IN ('teller','bank','flinks','simplefin')
		  AND transfer_pair_id IS NULL
		  AND ` + typePred + `
		ORDER BY date
	`
	rows, err := conn.Query(q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []candidate
	for rows.Next() {
		var c candidate
		if err := rows.Scan(&c.id, &c.amount, &c.date, &c.merchantNorm, &c.note, &c.accountKey); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}
