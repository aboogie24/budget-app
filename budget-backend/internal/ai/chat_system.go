package ai

import (
	"database/sql"
	"log"
)

// BuildLiveSystemPrompt assembles SystemPrompt + AppGuide + financial context +
// memories + action outcomes. Financial numbers use household sharing gates.
func BuildLiveSystemPrompt(dbConn *sql.DB, userID, householdID, userName, convoID string) string {
	ctxData := ContextData{UserName: userName}
	if householdID != "" {
		var hhName string
		_ = dbConn.QueryRow(`SELECT COALESCE(name, '') FROM households WHERE id = $1`, householdID).Scan(&hhName)
		ctxData.HouseholdName = hhName
	}
	assessment := AssessFrameworkLevel(dbConn, userID, householdID)
	ctxData.FrameworkLevel = assessment.LevelName
	ctxData.FrameworkPct = assessment.CompletedPct
	if err := LoadFinancialContext(dbConn, userID, householdID, &ctxData); err != nil {
		log.Printf("BuildLiveSystemPrompt: financial context error: %v", err)
	}
	systemPrompt := SystemPrompt + "\n\n" + AppGuide
	if contextBlock := BuildContextBlock(ctxData); contextBlock != "" {
		systemPrompt += "\n\n" + contextBlock
	}
	if mems, memErr := LoadAdvisorMemories(dbConn, userID, householdID); memErr != nil {
		log.Printf("load advisor memories error: %v", memErr)
	} else if memBlock := BuildMemoryBlock(mems); memBlock != "" {
		systemPrompt += "\n\n" + memBlock
	}
	if outcomes := BuildActionOutcomesBlock(dbConn, userID, convoID); outcomes != "" {
		systemPrompt += "\n\n" + outcomes
	}
	return systemPrompt
}
