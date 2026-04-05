package flinks

// GenerateTokenRequest is the body for the GenerateAuthorizeToken endpoint.
type GenerateTokenRequest struct {
	Product string `json:"Product"`
}

// GenerateTokenResponse from the GenerateAuthorizeToken endpoint.
type GenerateTokenResponse struct {
	Token          string `json:"Token"`
	HttpStatusCode int    `json:"HttpStatusCode"`
}

// AuthorizeRequest is the body for the Authorize endpoint.
type AuthorizeRequest struct {
	LoginId          string `json:"LoginId"`
	MostRecentCached bool   `json:"MostRecentCached"`
}

// AuthorizeResponse from the Authorize endpoint.
type AuthorizeResponse struct {
	RequestId      string `json:"RequestId"`
	HttpStatusCode int    `json:"HttpStatusCode"`
}

// AccountsDetailRequest is the body for GetAccountsDetail.
type AccountsDetailRequest struct {
	RequestId string `json:"RequestId"`
}

// AccountsDetailResponse contains full account + transaction data.
type AccountsDetailResponse struct {
	RequestId      string    `json:"RequestId"`
	HttpStatusCode int       `json:"HttpStatusCode"`
	Accounts       []Account `json:"Accounts"`
}

// AccountsSummaryRequest is the body for GetAccountsSummary.
type AccountsSummaryRequest struct {
	RequestId string `json:"RequestId"`
}

// AccountsSummaryResponse for balance-only queries.
type AccountsSummaryResponse struct {
	RequestId      string    `json:"RequestId"`
	HttpStatusCode int       `json:"HttpStatusCode"`
	Accounts       []Account `json:"Accounts"`
}

// Account represents a single bank account from Flinks.
type Account struct {
	Id              string        `json:"Id"`
	Title           string        `json:"Title"`
	AccountNumber   string        `json:"AccountNumber"`
	Category        string        `json:"Category"` // OperationAccount, CreditCard, Savings, etc.
	Currency        string        `json:"Currency"`
	Balance         Balance       `json:"Balance"`
	Transactions    []Transaction `json:"Transactions"`
	InstitutionName string        `json:"InstitutionName"`
}

// Balance holds current and available balances.
type Balance struct {
	Current   float64 `json:"Current"`
	Available float64 `json:"Available"`
}

// Transaction represents a single bank transaction from Flinks.
type Transaction struct {
	Id          string  `json:"Id"`
	Date        string  `json:"Date"` // ISO date string
	Description string  `json:"Description"`
	Debit       float64 `json:"Debit"`
	Credit      float64 `json:"Credit"`
	Balance     float64 `json:"Balance"`
}
