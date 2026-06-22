package handler

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/palemoky/fight-the-landlord/internal/protocol"
	"github.com/palemoky/fight-the-landlord/internal/protocol/codec"
	"github.com/palemoky/fight-the-landlord/internal/server/session"
	"github.com/palemoky/fight-the-landlord/internal/testutil"
)

func TestHandler_HandleSetName_UpdatesCurrentPlayer(t *testing.T) {
	mockServer := new(testutil.MockServer)
	mockClient := new(testutil.MockClient)
	sessionManager := session.NewSessionManager()
	sessionManager.CreateSession("p1", "OldName")

	h := NewHandler(HandlerDeps{
		Server:         mockServer,
		SessionManager: sessionManager,
	})

	mockClient.On("GetID").Return("p1")
	mockClient.On("SetName", "Flamez").Once()
	mockServer.On("GetOnlineCount").Return(1).Once()
	mockClient.On("SendMessage", mock.MatchedBy(func(msg *protocol.Message) bool {
		if msg.Type != protocol.MsgOnlineCount {
			return false
		}
		payload, err := codec.ParsePayload[protocol.OnlineCountPayload](msg)
		return err == nil && payload.Count == 1
	})).Once()

	msg := codec.MustNewMessage(protocol.MsgSetName, protocol.SetNamePayload{Name: " Flamez "})
	h.handleSetName(mockClient, msg)

	assert.Equal(t, "Flamez", sessionManager.GetSession("p1").PlayerName)
	mockClient.AssertExpectations(t)
	mockServer.AssertExpectations(t)
}

func TestHandler_HandleReconnect_RestoresClientIdentity(t *testing.T) {
	mockServer := new(testutil.MockServer)
	mockClient := new(testutil.MockClient)
	sessionManager := session.NewSessionManager()
	playerSession := sessionManager.CreateSession("player-old", "Flamez")
	sessionManager.CreateSession("player-temporary", "Temporary")

	h := NewHandler(HandlerDeps{
		Server:         mockServer,
		SessionManager: sessionManager,
	})

	mockClient.On("GetID").Return("player-temporary").Once()
	mockServer.On("UnregisterClient", "player-temporary").Once()
	mockClient.On("SetID", "player-old").Once()
	mockClient.On("SetName", "Flamez").Once()
	mockServer.On("RegisterClient", "player-old", mockClient).Once()
	mockClient.On("SendMessage", mock.MatchedBy(func(msg *protocol.Message) bool {
		if msg.Type != protocol.MsgReconnected {
			return false
		}
		payload, err := codec.ParsePayload[protocol.ReconnectedPayload](msg)
		return err == nil && payload.PlayerID == "player-old" && payload.PlayerName == "Flamez"
	})).Once()

	msg := codec.MustNewMessage(protocol.MsgReconnect, protocol.ReconnectPayload{
		PlayerID: "player-old",
		Token:    playerSession.ReconnectToken,
	})
	h.handleReconnect(mockClient, msg)

	assert.Nil(t, sessionManager.GetSession("player-temporary"))
	assert.True(t, sessionManager.IsOnline("player-old"))
	mockClient.AssertExpectations(t)
	mockServer.AssertExpectations(t)
}
