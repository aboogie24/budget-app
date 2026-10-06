package households

// Optional Postgres integration tests. Skipped unless CRITIC_PG_DSN is set.
// Adapted from critic throwaway coverage for M1–M5 FK / race behaviors.
import (
	"database/sql"
	"errors"
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

func TestPG_ParallelDoubleAccept(t *testing.T) {
	db := openPG(t)
	f := setupPG(t, db)
	var wg sync.WaitGroup
	out := make([]string, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			r, c, e := AcceptInvite(db, AcceptRequest{Code: f.code, UserID: f.B})
			switch {
			case e != nil:
				out[i] = "err:" + e.Error()
			case c != nil:
				out[i] = "409:" + c.Code
			default:
				out[i] = "200:" + r.Action
			}
		}(i)
	}
	wg.Wait()
	ok := 0
	for _, s := range out {
		if s == "200:discard_solo" || s == "200:already_member" {
			ok++
		}
	}
	if ok != 2 {
		t.Fatalf("results=%v want both 200", out)
	}
}

func TestPG_CrossInviteNoDeadlock(t *testing.T) {
	db := openPG(t)
	deadlocks := 0
	for iter := 0; iter < 10; iter++ {
		f := setupPG(t, db)
		code2 := nid()
		if _, err := db.Exec(`INSERT INTO household_invites(code,household_id,created_by,expires_at,invitee_email) VALUES($1,$2,$3,$4,$5)`,
			code2, f.hhB, f.B, time.Now().UTC().Add(48*time.Hour), f.A+"@a.x"); err != nil {
			t.Fatal(err)
		}
		var wg sync.WaitGroup
		var e1, e2 error
		wg.Add(2)
		go func() { defer wg.Done(); _, _, e1 = AcceptInvite(db, AcceptRequest{Code: f.code, UserID: f.B}) }()
		go func() { defer wg.Done(); _, _, e2 = AcceptInvite(db, AcceptRequest{Code: code2, UserID: f.A}) }()
		wg.Wait()
		for _, e := range []error{e1, e2} {
			if e != nil && (containsFold(e.Error(), "deadlock") || containsFold(e.Error(), "40P01")) {
				deadlocks++
			}
		}
	}
	if deadlocks > 0 {
		t.Fatalf("deadlocks=%d", deadlocks)
	}
}

func containsFold(s, sub string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(sub))
}
