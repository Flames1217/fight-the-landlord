package handler

import (
	"log"
	"strings"
	"time"
	"unicode"

	"github.com/palemoky/fight-the-landlord/internal/protocol"
	"github.com/palemoky/fight-the-landlord/internal/protocol/codec"
	"github.com/palemoky/fight-the-landlord/internal/server/session"
	"github.com/palemoky/fight-the-landlord/internal/types"
)

// handlePing 处理心跳消息
func (h *Handler) handlePing(client types.ClientInterface, msg *protocol.Message) {
	payload, err := codec.ParsePayload[protocol.PingPayload](msg)
	if err != nil {
		return
	}

	// 立即回复 pong
	client.SendMessage(codec.MustNewMessage(protocol.MsgPong, protocol.PongPayload{
		ClientTimestamp: payload.Timestamp,
		ServerTimestamp: time.Now().UnixMilli(),
	}))
}

// handleSetName 处理昵称修改
func (h *Handler) handleSetName(client types.ClientInterface, msg *protocol.Message) {
	payload, err := codec.ParsePayload[protocol.SetNamePayload](msg)
	if err != nil {
		client.SendMessage(codec.NewErrorMessage(protocol.ErrCodeInvalidMsg))
		return
	}

	name := normalizeNickname(payload.Name)
	if name == "" {
		client.SendMessage(codec.NewErrorMessageWithText(protocol.ErrCodeInvalidMsg, "昵称不能为空"))
		return
	}

	client.SetName(name)
	h.sessionManager.SetName(client.GetID(), name)
	client.SendMessage(codec.MustNewMessage(protocol.MsgOnlineCount, protocol.OnlineCountPayload{
		Count: h.server.GetOnlineCount(),
	}))
}

// handleReconnect 处理断线重连
func (h *Handler) handleReconnect(client types.ClientInterface, msg *protocol.Message) {
	payload, err := codec.ParsePayload[protocol.ReconnectPayload](msg)
	if err != nil {
		client.SendMessage(codec.NewErrorMessage(protocol.ErrCodeInvalidMsg))
		return
	}

	// 验证重连令牌
	if !h.sessionManager.CanReconnect(payload.Token, payload.PlayerID) {
		client.SendMessage(codec.NewErrorMessageWithText(protocol.ErrCodeUnknown, "重连令牌无效或已过期"))
		return
	}

	// 获取旧会话
	session := h.sessionManager.GetSession(payload.PlayerID)
	if session == nil {
		client.SendMessage(codec.NewErrorMessageWithText(protocol.ErrCodeUnknown, "会话不存在"))
		return
	}

	oldID := client.GetID()

	// 移除本次 WebSocket 握手创建的临时身份，恢复原会话身份。
	h.server.UnregisterClient(oldID)
	if oldID != session.PlayerID {
		h.sessionManager.DeleteSession(oldID)
	}
	client.SetID(session.PlayerID)
	client.SetName(session.PlayerName)
	h.server.RegisterClient(session.PlayerID, client)

	// 标记会话上线
	h.sessionManager.SetOnline(session.PlayerID)

	// 构建重连响应
	reconnectPayload := protocol.ReconnectedPayload{
		PlayerID:   session.PlayerID,
		PlayerName: session.PlayerName,
	}

	// 如果在房间中，尝试恢复房间信息
	if session.RoomCode != "" {
		h.tryRestoreRoomState(client, session, &reconnectPayload)
	}

	// 发送重连成功消息
	client.SendMessage(codec.MustNewMessage(protocol.MsgReconnected, reconnectPayload))

	// 快照恢复后，若正轮到该玩家，补发当前回合通知，恢复其操作提示与倒计时（快照本身不含 IsGrab / 剩余时间等回合信息）。须在 MsgReconnected 之后发送，确保客户端先应用快照、再设置回合提示。
	if reconnectPayload.GameState != nil && reconnectPayload.GameState.CurrentTurn == session.PlayerID {
		if gameSession := h.GetGameSession(session.RoomCode); gameSession != nil {
			gameSession.ResendTurnTo(client)
		}
	}

	log.Printf("🔄 玩家 %s (%s) 重连成功", session.PlayerName, session.PlayerID)
}

func normalizeNickname(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return ""
	}

	runes := make([]rune, 0, len([]rune(name)))
	for _, r := range name {
		if unicode.IsControl(r) {
			continue
		}
		runes = append(runes, r)
	}
	if len(runes) > 16 {
		runes = runes[:16]
	}

	return strings.TrimSpace(string(runes))
}

// tryRestoreRoomState 尝试恢复房间状态
func (h *Handler) tryRestoreRoomState(client types.ClientInterface, session *session.PlayerSession, payload *protocol.ReconnectedPayload) {
	room := h.roomManager.GetRoom(session.RoomCode)
	if room == nil {
		return
	}

	// 身份已恢复，可直接按原玩家 ID 替换房间中的旧连接。
	client.SetRoom(session.RoomCode)
	if err := h.roomManager.ReconnectPlayer(client, client); err != nil {
		log.Printf("重连到房间失败: %v", err)
		return
	}

	payload.RoomCode = session.RoomCode

	// 如果游戏正在进行，恢复游戏状态
	if gameSession := h.GetGameSession(session.RoomCode); gameSession != nil {
		payload.GameState = gameSession.BuildGameStateDTO(session.PlayerID, h.sessionManager)
	}
}
