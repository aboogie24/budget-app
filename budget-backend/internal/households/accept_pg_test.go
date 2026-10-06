package households

// Optional Postgres integration tests. Skipped unless CRITIC_PG_DSN is set.
// Adapted from critic throwaway coverage for M1–M5 FK / race behaviors.
import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gofrs/uuid"
	_ "github.com/lib/pq"
)

func nid() string { return uuid.Must(uuid.NewV4()).String() }

type pgFx struct{ A, B, hhA, hhB, code string }

func setupPG(t *testing.T, db *sql.DB) pgFx {
	t.Helper()
	f := pgFx{A: nid(), B: nid(), hhA: nid(), hhB: nid(), code: nid()}
	must := func(q string, a ...any) {
		t.Helper()
		if _, err := db.Exec(q, a...); err != nil {
			t.Fatalf("%s: %v", q, err)
		}
	}
	must(`INSERT INTO users(id,email) VALUES($1,$2),($3,$4)`, f.A, f.A+"@a.x", f.B, f.B+"@b.x")
	must(`INSERT INTO households(id,name) VALUES($1,'A'),($2,'B solo')`, f.hhA, f.hhB)
	must(`INSERT INTO household_members(household_id,user_id,role) VALUES($1,$2,'owner'),($3,$4,'owner')`, f.hhA, f.A, f.hhB, f.B)
	must(`INSERT INTO household_invites(code,household_id,created_by,expires_at,invitee_email) VALUES($1,$2,$3,$4,$5)`,
		f.code, f.hhA, f.A, time.Now().UTC().Add(48*time.Hour), f.B+"@b.x")
	must(`INSERT INTO budgets(id,user_id,household_id,name,amount,type) VALUES($1,$2,$3,'Groceries',100,'expense')`, nid(), f.B, f.hhB)
	return f
}

func openPG(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("CRITIC_PG_DSN")
	if dsn == "" {
		t.Skip("no CRITIC_PG_DSN")
	}
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func cntPG(t *testing.T, db *sql.DB, q string, a ...any) int {
	t.Helper()
	var n int
	if err := db.QueryRow(q, a...).Scan(&n); err != nil {
		t.Fatalf("%s: %v", q, err)
	}
	return n
}

func TestPG_EmptyDiscardBaseline(t *testing.T) {
	db := openPG(t)
	f := setupPG(t, db)
	res, c, err := AcceptInvite(db, AcceptRequest{Code: f.code, UserID: f.B})
	if err != nil || c != nil {
		t.Fatalf("res=%+v conflict=%+v err=%v", res, c, err)
	}
	if cntPG(t, db, `SELECT COUNT(*) FROM households WHERE id=$1`, f.hhB) != 0 {
		t.Fatal("solo should be deleted")
	}
}

func TestPG_EmptySoloWithCustomCategoryMigratesOrCounts(t *testing.T) {
	db := openPG(t)
	f := setupPG(t, db)
	if _, err := db.Exec(`INSERT INTO categories(id,name,user_id,household_id,type) VALUES($1,'Pets',$2,$3,'expense')`, nid(), f.B, f.hhB); err != nil {
		t.Fatal(err)
	}
	pv, err := BuildAcceptPreview(db, f.B, f.hhA)
	if err != nil {
		t.Fatal(err)
	}
	if pv.Action != ActionMigrateSolo {
		t.Fatalf("preview action=%s want migrate_solo", pv.Action)
	}
	res, c, err := AcceptInvite(db, AcceptRequest{Code: f.code, UserID: f.B, ConfirmMigrate: true})
	if err != nil || c != nil {
		t.Fatalf("res=%+v conflict=%v err=%v", res, c, err)
	}
	if cntPG(t, db, `SELECT COUNT(*) FROM categories WHERE household_id=$1`, f.hhA) != 1 {
		t.Fatal("category should re-point to target")
	}
}

func TestPG_DiscardSpendingAlertOnStarter(t *testing.T) {
	db := openPG(t)
	f := setupPG(t, db)
	var bid string
	if err := db.QueryRow(`SELECT id FROM budgets WHERE user_id=$1`, f.B).Scan(&bid); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO spending_alerts(household_id,budget_id) VALUES($1,$2)`, f.hhB, bid); err != nil {
		t.Fatal(err)
	}
	res, c, err := AcceptInvite(db, AcceptRequest{Code: f.code, UserID: f.B})
	if err != nil || c != nil {
		t.Fatalf("res=%+v conflict=%v err=%v", res, c, err)
	}
}

func TestPG_MigrateNoSilentLoss(t *testing.T) {
	db := openPG(t)
	f := setupPG(t, db)
	cat := nid()
	billID := nid()
	stmts := []struct {
		q string
		a []any
	}{
		{`INSERT INTO transactions(id,user_id,household_id,type,amount,date) VALUES($1,$2,$3,'expense',5,NOW())`, []any{nid(), f.B, f.hhB}},
		{`INSERT INTO categories(id,name,user_id,type) VALUES($1,'Coffee',$2,'expense')`, []any{cat, f.B}},
		{`INSERT INTO category_mapping_rules(user_id,household_id,rule_type,match_value,category_id) VALUES($1,$2,'merchant','starbucks',$3)`, []any{f.B, f.hhB, cat}},
		{`INSERT INTO advisor_memories(household_id,user_id,scope,fact) VALUES($1,$2,'shared','Saving for a house')`, []any{f.hhB, f.B}},
		{`INSERT INTO bills(id,user_id,household_id,name,amount_due,due_day) VALUES($1,$2,$3,'Rent',1000,1)`, []any{billID, f.B, f.hhB}},
		{`INSERT INTO bill_payments(id,bill_id,user_id,household_id,amount_paid,paid_date,period_start,period_end) VALUES($1,$2,$3,$4,1000,NOW(),NOW(),NOW())`, []any{nid(), billID, f.B, f.hhB}},
	}
	for _, s := range stmts {
		if _, err := db.Exec(s.q, s.a...); err != nil {
			t.Fatalf("%s: %v", s.q, err)
		}
	}
	res, c, err := AcceptInvite(db, AcceptRequest{Code: f.code, UserID: f.B, ConfirmMigrate: true})
	if err != nil || c != nil {
		t.Fatalf("res=%+v conflict=%v err=%v", res, c, err)
	}
	if cntPG(t, db, `SELECT COUNT(*) FROM category_mapping_rules WHERE user_id=$1 AND household_id=$2`, f.B, f.hhA) != 1 {
		t.Fatal("mapping rules should migrate")
	}
	if cntPG(t, db, `SELECT COUNT(*) FROM advisor_memories WHERE user_id=$1 AND household_id=$2`, f.B, f.hhA) != 1 {
		t.Fatal("advisor memories should migrate")
	}
	if cntPG(t, db, `SELECT COUNT(*) FROM bill_payments WHERE household_id=$1`, f.hhA) != 1 {
		t.Fatal("bill_payments should re-point")
	}
	if cntPG(t, db, `SELECT COUNT(*) FROM bill_payments WHERE household_id=$1`, f.hhB) != 0 {
		t.Fatal("bill_payments should not orphan on solo")
	}
}

func TestPG_ReAcceptAfterSuccess(t *testing.T) {
	db := openPG(t)
	f := setupPG(t, db)
	r1, _, e1 := AcceptInvite(db, AcceptRequest{Code: f.code, UserID: f.B})
	if e1 != nil || r1 == nil {
		t.Fatalf("first failed: %v", e1)
	}
	r2, c2, e2 := AcceptInvite(db, AcceptRequest{Code: f.code, UserID: f.B})
	if e2 != nil || c2 != nil || r2 == nil || !r2.AlreadyMember {
		t.Fatalf("second=%+v conflict=%v err=%v invalid=%v", r2, c2, e2, errors.Is(e2, ErrInvalidInvite))
	}
}

// outcome renders an AcceptInvite result as "<http status>:<detail>" (5xx = server error).
func outcome(r *AcceptResult, c *AcceptConflict, e error) string {
	switch {
	case e != nil:
		return fmt.Sprintf("%d:%v", StatusForAcceptError(e), e)
	case c != nil:
		return "409:" + c.Code
	default:
		return "200:" + r.Action
	}
}

func is5xx(s string) bool { return strings.HasPrefix(s, "5") }

func TestPG_ParallelDoubleAccept(t *testing.T) {
	db := openPG(t)
	for iter := 0; iter < 10; iter++ {
		f := setupPG(t, db)
		var wg sync.WaitGroup
		out := make([]string, 2)
		for i := 0; i < 2; i++ {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				out[i] = outcome(AcceptInvite(db, AcceptRequest{Code: f.code, UserID: f.B}))
			}(i)
		}
		wg.Wait()
		for _, s := range out {
			if is5xx(s) {
				t.Fatalf("iter %d: 5xx in results=%v", iter, out)
			}
		}
		// Spec: one wins (discard_solo), the other is idempotent already_member.
		won, idem := 0, 0
		for _, s := range out {
			switch s {
			case "200:discard_solo":
				won++
			case "200:already_member":
				idem++
			}
		}
		if won != 1 || idem != 1 {
			t.Fatalf("iter %d: results=%v want one discard_solo + one already_member", iter, out)
		}
		if n := cntPG(t, db, `SELECT COUNT(*) FROM household_members WHERE user_id=$1 AND household_id=$2`, f.B, f.hhA); n != 1 {
			t.Fatalf("iter %d: membership rows on target=%d", iter, n)
		}
	}
}

func TestPG_CrossInviteNoDeadlock(t *testing.T) {
	db := openPG(t)
	for iter := 0; iter < 20; iter++ {
		f := setupPG(t, db)
		code2 := nid()
		if _, err := db.Exec(`INSERT INTO household_invites(code,household_id,created_by,expires_at,invitee_email) VALUES($1,$2,$3,$4,$5)`,
			code2, f.hhB, f.B, time.Now().UTC().Add(48*time.Hour), f.A+"@a.x"); err != nil {
			t.Fatal(err)
		}
		var wg sync.WaitGroup
		out := make([]string, 2)
		wg.Add(2)
		go func() { defer wg.Done(); out[0] = outcome(AcceptInvite(db, AcceptRequest{Code: f.code, UserID: f.B})) }()
		go func() { defer wg.Done(); out[1] = outcome(AcceptInvite(db, AcceptRequest{Code: code2, UserID: f.A})) }()
		wg.Wait()
		ok := 0
		for _, s := range out {
			if is5xx(s) || containsFold(s, "deadlock") || containsFold(s, "40P01") {
				t.Fatalf("iter %d: server error in results=%v", iter, out)
			}
			if strings.HasPrefix(s, "200:") {
				ok++
			}
		}
		// First commit wins; the other invite died with the deleted solo → 400 invalid.
		if ok != 1 {
			t.Fatalf("iter %d: results=%v want exactly one 200", iter, out)
		}
	}
}

// N2: an unknown code is 400 even for a user who is a member of some household.
func TestPG_UnknownCodeForMember400(t *testing.T) {
	db := openPG(t)
	f := setupPG(t, db)
	if _, _, err := AcceptInvite(db, AcceptRequest{Code: f.code, UserID: f.B}); err != nil {
		t.Fatal(err)
	}
	for _, code := range []string{nid(), "not-a-uuid", "' OR 1=1 --"} {
		got := outcome(AcceptInvite(db, AcceptRequest{Code: code, UserID: f.B}))
		if !strings.HasPrefix(got, "400:") {
			t.Fatalf("code %q: got %s want 400", code, got)
		}
	}
	// Owner A is a member of hhA too; a random code must not echo already_member.
	if got := outcome(AcceptInvite(db, AcceptRequest{Code: nid(), UserID: f.A})); !strings.HasPrefix(got, "400:") {
		t.Fatalf("owner random code: %s", got)
	}
}

// N2: a consumed (tombstoned) code only yields already_member for members of its household.
func TestPG_ConsumedCodeOtherUser400(t *testing.T) {
	db := openPG(t)
	f := setupPG(t, db)
	if _, _, err := AcceptInvite(db, AcceptRequest{Code: f.code, UserID: f.B}); err != nil {
		t.Fatal(err)
	}
	if cntPG(t, db, `SELECT COUNT(*) FROM household_invites WHERE code=$1 AND accepted_at IS NOT NULL AND accepted_by=$2`, f.code, f.B) != 1 {
		t.Fatal("consumed invite should be tombstoned with accepted_at/accepted_by")
	}
	// Third user C with their own solo (not a member of hhA) replays B's consumed code.
	c, hhC := nid(), nid()
	if _, err := db.Exec(`INSERT INTO users(id,email) VALUES($1,$2)`, c, c+"@c.x"); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO households(id,name) VALUES($1,'C')`, hhC); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO household_members(household_id,user_id,role) VALUES($1,$2,'owner')`, hhC, c); err != nil {
		t.Fatal(err)
	}
	if got := outcome(AcceptInvite(db, AcceptRequest{Code: f.code, UserID: c})); !strings.HasPrefix(got, "400:") {
		t.Fatalf("replayed consumed code by non-member: %s want 400", got)
	}
	if cntPG(t, db, `SELECT COUNT(*) FROM household_members WHERE user_id=$1 AND household_id=$2`, c, f.hhA) != 0 {
		t.Fatal("non-member must not join via consumed code")
	}
}

// N3: memories and mapping rules are real data → confirm_migrate, never silent cascade.
func TestPG_MemoriesAndRulesRequireConfirm(t *testing.T) {
	db := openPG(t)
	f := setupPG(t, db)
	var sysCat string
	if err := db.QueryRow(`SELECT id FROM categories WHERE household_id IS NULL AND user_id IS NULL LIMIT 1`).Scan(&sysCat); err != nil {
		sysCat = nid()
		if _, err := db.Exec(`INSERT INTO categories(id,name,type) VALUES($1,'SysCat','expense')`, sysCat); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := db.Exec(`INSERT INTO advisor_memories(household_id,user_id,scope,fact) VALUES($1,$2,'shared','Saving for a house')`, f.hhB, f.B); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO category_mapping_rules(user_id,household_id,rule_type,match_value,category_id) VALUES($1,$2,'merchant','starbucks',$3)`, f.B, f.hhB, sysCat); err != nil {
		t.Fatal(err)
	}
	pv, err := BuildAcceptPreview(db, f.B, f.hhA)
	if err != nil {
		t.Fatal(err)
	}
	if pv.Action != ActionMigrateSolo || pv.Blockers.AdvisorMemories != 1 || pv.Blockers.CategoryMappingRules != 1 {
		t.Fatalf("preview=%+v", pv)
	}
	if got := outcome(AcceptInvite(db, AcceptRequest{Code: f.code, UserID: f.B})); got != "409:migrate_confirmation_required" {
		t.Fatalf("without confirm: %s", got)
	}
	if got := outcome(AcceptInvite(db, AcceptRequest{Code: f.code, UserID: f.B, ConfirmMigrate: true})); got != "200:migrate_solo" {
		t.Fatalf("with confirm: %s", got)
	}
	if cntPG(t, db, `SELECT COUNT(*) FROM advisor_memories WHERE user_id=$1 AND household_id=$2`, f.B, f.hhA) != 1 ||
		cntPG(t, db, `SELECT COUNT(*) FROM category_mapping_rules WHERE user_id=$1 AND household_id=$2`, f.B, f.hhA) != 1 {
		t.Fatal("memories/rules should be on target after confirmed migrate")
	}
}

// N4: migrate keeps alerts on real (non-starter) budgets and re-points them.
func TestPG_MigrateKeepsRealBudgetAlert(t *testing.T) {
	db := openPG(t)
	f := setupPG(t, db)
	var starter string
	if err := db.QueryRow(`SELECT id FROM budgets WHERE user_id=$1`, f.B).Scan(&starter); err != nil {
		t.Fatal(err)
	}
	vacation := nid()
	if _, err := db.Exec(`INSERT INTO budgets(id,user_id,household_id,name,amount,type) VALUES($1,$2,$3,'Vacation fund',500,'expense')`, vacation, f.B, f.hhB); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO spending_alerts(household_id,budget_id) VALUES($1,$2),($1,$3)`, f.hhB, vacation, starter); err != nil {
		t.Fatal(err)
	}
	if got := outcome(AcceptInvite(db, AcceptRequest{Code: f.code, UserID: f.B, ConfirmMigrate: true})); got != "200:migrate_solo" {
		t.Fatalf("got %s", got)
	}
	if n := cntPG(t, db, `SELECT COUNT(*) FROM spending_alerts WHERE budget_id=$1 AND household_id=$2`, vacation, f.hhA); n != 1 {
		t.Fatalf("real-budget alert on target=%d want 1", n)
	}
	if n := cntPG(t, db, `SELECT COUNT(*) FROM spending_alerts WHERE budget_id=$1`, starter); n != 0 {
		t.Fatalf("starter alert should be discarded, got %d", n)
	}
}

func containsFold(s, sub string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(sub))
}
