package ai

import (
	"database/sql"
	"encoding/json"
	"fmt"
)

func ExecuteTool(conn *sql.DB, userID string, householdID string, toolName string, input json.RawMessage) (string, error) {
	switch toolName {
	case "get_financial_snapshot":
		return getFinancialSnapshot(conn, userID, householdID, input)
	case "get_debts":
		return getDebts(conn, userID, householdID, input)
	case "get_savings_goals":
		return getSavingsGoals(conn, userID, householdID, input)
	case "get_spending_by_category":
		return getSpendingByCategory(conn, userID, householdID, input)
	case "get_bills":
		return getBills(conn, userID, householdID, input)
	case "calculate_debt_payoff":
		return calculateDebtPayoffTool(conn, userID, householdID, input)
	case "project_savings":
		return projectSavingsTool(conn, userID, householdID, input)
	case "get_partner_status":
		return getPartnerStatus(conn, userID, householdID)
	case "create_financial_plan":
		return createFinancialPlanTool(conn, userID, householdID, input)
	case "assess_savings_goal":
		return assessSavingsGoalTool(conn, userID, householdID, input)
	case "remember_fact":
		return rememberFactTool(conn, userID, householdID, input)
	case "create_savings_goal":
		return createSavingsGoalTool(conn, userID, householdID, input)
	case "update_savings_goal":
		return updateSavingsGoalTool(conn, userID, householdID, input)
	case "create_budget":
		return createBudgetTool(conn, userID, householdID, input)
	case "log_transaction":
		return logTransactionTool(conn, userID, householdID, input)
	case "create_category":
		return createCategoryTool(conn, userID, householdID, input)
	case "assign_transaction_category":
		return assignTransactionCategoryTool(conn, userID, householdID, input)
	case "upsert_category_rule":
		return upsertCategoryRuleTool(conn, userID, householdID, input)
	case "web_search":
		return executeWebSearch(userID, input)
	default:
		return "", fmt.Errorf("unknown tool: %s", toolName)
	}
}
