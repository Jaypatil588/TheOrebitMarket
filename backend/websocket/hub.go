package websocket

import (
	"encoding/json"
	"sync"
)

// Hub maintains the set of active clients and broadcasts messages to clients.
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	onConnect  []func(*Client)
	mu         sync.Mutex
}

// NewHub creates a new active WebSocket Hub
func NewHub() *Hub {
	return &Hub{
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
	}
}

// Run executes the hub operations in a concurrent loop
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			callbacks := append([]func(*Client){}, h.onConnect...)
			h.mu.Unlock()
			for _, fn := range callbacks {
				if fn != nil {
					fn(client)
				}
			}
		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()
		case message := <-h.broadcast:
			h.mu.Lock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.Unlock()
		}
	}
}

// OnClientConnect registers a callback invoked for each new WebSocket client.
func (h *Hub) OnClientConnect(fn func(*Client)) {
	if fn == nil {
		return
	}
	h.mu.Lock()
	h.onConnect = append(h.onConnect, fn)
	h.mu.Unlock()
}

// BroadcastJSON handles JSON marshaling and publishes a struct to all clients
func (h *Hub) BroadcastJSON(v interface{}) error {
	data, err := json.Marshal(v)
	if err != nil {
		return err
	}
	h.broadcast <- data
	return nil
}
