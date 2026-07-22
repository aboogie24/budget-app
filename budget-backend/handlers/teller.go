package handlers

import (
	"encoding/json"
	"html/template"
	"log"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/internal/bankprovider"
	"github.com/aboogie/budget-backend/internal/teller"
	"github.com/aboogie/budget-backend/internal/transfers"
	"github.com/gofrs/uuid"
)

// tellerConnectRequest is the body for POST /auth/teller/connect.
type tellerConnectRequest struct {
	AccessToken  string `json:"access_token"`
	EnrollmentID string `json:"enrollment_id"`
	UserID       string `json:"user_id"`
	Institution  string `json:"institution"`
}

// tellerConnectPageData is injected into the Teller Connect HTML page.
// EnrollmentID is set when re-authenticating an existing enrollment so the
// widget opens directly to the bank login instead of the institution picker.
type tellerConnectPageData struct {
	AppID        string
	Environment  string
	EnrollmentID string
}

// tellerConnectPageTmpl hosts the Teller Connect widget. It loads the Teller
// Connect script, opens the picker, and posts the enrollment back to the
// React Native WebView via postMessage (falling back to a deep link in a
// plain browser). The access token is never placed in a URL.
var tellerConnectPageTmpl = template.Must(template.New("teller-connect").Parse(`<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0b1021;color:#94a3b8;font-family:system-ui,-apple-system,sans-serif;
       display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}
  .wrap{padding:24px}
  .spinner{width:32px;height:32px;border:3px solid rgba(192,132,252,0.2);border-top-color:#c084fc;
           border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}
  @keyframes spin{to{transform:rotate(360deg)}}
  .err{color:#f87171;margin-top:12px}
</style>
</head><body>
<div class="wrap">
  <div class="spinner"></div>
  <p id="msg">Loading Teller…</p>
  <p id="err" class="err"></p>
</div>
<script src="https://cdn.teller.io/connect/connect.js"></script>
<script>
(function(){
  var msg = document.getElementById('msg');
  var errEl = document.getElementById('err');
  function send(obj){
    var data = JSON.stringify(obj);
    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(data);
    } else {
      window.location.href = 'budgetapp://teller-callback?data=' + encodeURIComponent(data);
    }
  }
  try {
    var enrollmentId = {{ .EnrollmentID }};
    var setupOpts = {
      applicationId: {{ .AppID }},
      environment: {{ .Environment }},
      products: ['transactions', 'balance'],
      onInit: function(){ msg.textContent = enrollmentId ? 'Reconnecting your bank…' : 'Select your bank…'; },
      onSuccess: function(enrollment){
        send({
          event: 'success',
          access_token: enrollment.accessToken,
          enrollment_id: enrollment.enrollment && enrollment.enrollment.id,
          user_id: enrollment.user && enrollment.user.id,
          institution: enrollment.enrollment && enrollment.enrollment.institution
                       ? enrollment.enrollment.institution.name : ''
        });
      },
      onExit: function(){ send({ event: 'exit' }); },
      onFailure: function(failure){
        send({ event: 'failure', message: failure && failure.message });
      }
    };
    if (enrollmentId) { setupOpts.enrollmentId = enrollmentId; }
    var tellerConnect = TellerConnect.setup(setupOpts);
    tellerConnect.open();
  } catch(e) {
    errEl.textContent = 'Failed to initialize: ' + e.message;
  }
})();
</script>
</body></html>`))

// TellerConnectPage serves the HTML that hosts the Teller Connect widget.
// GET /teller/connect-page  (public — loaded inside a WebView)
func TellerConnectPage(w http.ResponseWriter, r *http.Request) {
	client := teller.NewClient()
	if !client.IsAvailable() {
		http.Error(w, "Teller not configured", http.StatusServiceUnavailable)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	data := tellerConnectPageData{
		AppID:        client.AppID(),
		Environment:  client.Env(),
		EnrollmentID: r.URL.Query().Get("enrollment_id"),
	}
	if err := tellerConnectPageTmpl.Execute(w, data); err != nil {
		log.Printf("teller: failed to render connect page: %v", err)
	}
}

// TellerConnect stores the enrollment returned by Teller Connect as a linked
// account, then triggers an initial sync.
// POST /auth/teller/connect
func TellerConnect(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("X-User-ID")
	if userID == "" {
		userID, _ = getUserIDFromRequest(r)
	}
	if userID == "" {
		http.Error(w, "Missing user ID", http.StatusUnauthorized)
		return
	}

	var req tellerConnectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if req.AccessToken == "" || req.EnrollmentID == "" {
		http.Error(w, "Missing access_token or enrollment_id", http.StatusBadRequest)
		return
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	// Reuse an existing linked account for the same enrollment if present —
	// refresh the access token in case the user re-enrolled.
	var existingID string
	err = dbClient.QueryRow(`
		SELECT id FROM linked_accounts
		WHERE user_id = $1 AND item_id = $2 AND provider = 'teller'
	`, userID, req.EnrollmentID).Scan(&existingID)

	accountID := existingID
	status := "linked"
	if err == nil {
		_, uerr := dbClient.Exec(`
			UPDATE linked_accounts
			SET access_token = $1, teller_user_id = $2, item_status = 'good',
			    error_code = NULL, updated_at = NOW()
			WHERE id = $3
		`, req.AccessToken, nilIfEmpty(req.UserID), existingID)
		if uerr != nil {
			log.Printf("teller: failed to refresh linked account %s: %v", existingID, uerr)
			http.Error(w, "Failed to update linked account", http.StatusInternalServerError)
			return
		}
		status = "relinked"
	} else {
		accountID = uuid.Must(uuid.NewV4()).String()
		institution := req.Institution
		if institution == "" {
			institution = "Unknown Institution"
		}
		_, ierr := dbClient.Exec(`
			INSERT INTO linked_accounts
				(id, user_id, item_id, access_token, institution_name, provider,
				 teller_user_id, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, 'teller', $6, NOW(), NOW())
		`, accountID, userID, req.EnrollmentID, req.AccessToken, institution, nilIfEmpty(req.UserID))
		if ierr != nil {
			log.Printf("teller: failed to create linked account: %v", ierr)
			http.Error(w, "Failed to create linked account", http.StatusInternalServerError)
			return
		}
		log.Printf("teller: linked account created id=%s user=%s institution=%s", accountID, userID, institution)
	}

	// Trigger the initial sync in the background.
	go func(linkedID, accessToken string) {
		bg, err := db.New()
		if err != nil {
			log.Printf("teller: initial sync DB error: %v", err)
			return
		}
		defer bg.Close()

		householdID := db.ResolveHouseholdID(bg.Conn, userID)
		acct := bankprovider.LinkedAccount{
			ID:          linkedID,
			UserID:      userID,
			HouseholdID: householdID,
			Provider:    "teller",
			ItemID:      req.EnrollmentID,
			AccessToken: accessToken,
		}
		provider := bankprovider.NewTellerProvider()

		if synced, serr := provider.SyncTransactions(bg.Conn, acct); serr != nil {
			log.Printf("teller: initial transaction sync failed for %s: %v", linkedID, serr)
		} else {
			log.Printf("teller: initial sync completed, %d transactions for %s", synced, linkedID)
			// Auto-run the LLM categorization fallback over whatever the
			// deterministic rules couldn't place — a freshly linked account
			// arrives categorized without the user pressing anything. Skipped
			// silently when no API key is configured. Transfer pairing runs
			// first so inter-account moves stop reading as income/expense.
			if synced > 0 {
				if pairs, terr := transfers.DetectPairs(bg.Conn, userID); terr != nil {
					log.Printf("teller: post-sync transfer detection failed for %s: %v", linkedID, terr)
				} else if pairs > 0 {
					log.Printf("teller: post-sync transfer detection for %s: %d pairs", linkedID, pairs)
				}
				if m, c, a, aerr := RunAICategorization(bg, userID); aerr != nil {
					log.Printf("teller: post-sync AI categorization failed for %s: %v", linkedID, aerr)
				} else if m > 0 {
					log.Printf("teller: post-sync AI categorization for %s: merchants=%d classified=%d applied=%d", linkedID, m, c, a)
				}
			}
		}
		if updated, berr := provider.SyncBalances(bg.Conn, acct); berr != nil {
			log.Printf("teller: initial balance sync failed for %s: %v", linkedID, berr)
		} else {
			log.Printf("teller: initial balance sync completed, %d accounts for %s", updated, linkedID)
		}
	}(accountID, req.AccessToken)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{
		"id":       accountID,
		"status":   status,
		"provider": "teller",
	})
}
