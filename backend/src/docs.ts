import { OpenAPIV3 } from "openapi-types";

// Minimal OpenAPI 3.0 spec for REST routes, plus an extension describing Socket.io.
// Using type assertion to allow custom x-socketio extension
export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "The Fifth Command Auction Backend",
    version: "1.0.0",
    description:
      "API documentation for the Ethereum-based auction game backend. Socket.io events are documented under the `x-socketio` extension."
  },
  servers: [
    {
      url: "http://localhost:4000",
      description: "Local dev server"
    }
  ],
  paths: {
    "/api/v1/health": {
      get: {
        summary: "Health check",
        tags: ["system"],
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    uptime: { type: "number", example: 123.45 }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/v1/game/status": {
      get: {
        summary: "Get current game status",
        tags: ["game"],
        responses: {
          "200": {
            description: "Current game state",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    gameId: { type: "integer" },
                    gameState: {
                      type: "string",
                      enum: ["NotStarted", "InProgress", "Finished"]
                    },
                    currentRound: { type: "integer" },
                    totalCards: { type: "integer" },
                    currentCard: { type: "object" },
                    highestBid: {
                      type: "object",
                      properties: {
                        amount: { type: "integer" },
                        bidder: { type: "string", nullable: true }
                      }
                    },
                    revealedCards: {
                      type: "array",
                      items: { type: "object" }
                    }
                  }
                }
              }
            }
          },
          "500": {
            description: "Server error"
          }
        }
      }
    },
    "/api/v1/bid/submit": {
      post: {
        summary: "Submit a signed bid",
        tags: ["bidding"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message", "signature"],
                properties: {
                  message: {
                    type: "object",
                    required: [
                      "bidder",
                      "gameId",
                      "round",
                      "cardId",
                      "amount",
                      "timestamp",
                      "nonce"
                    ],
                    properties: {
                      bidder: { type: "string", format: "address" },
                      gameId: { type: "integer" },
                      round: { type: "integer" },
                      cardId: { type: "integer" },
                      amount: { type: "integer" },
                      timestamp: { type: "integer" },
                      nonce: { type: "integer" }
                    }
                  },
                  signature: { type: "string" }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Bid accepted or rejected with details",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    {
                      type: "object",
                      properties: {
                        ok: { type: "boolean", enum: [true] },
                        bid: { type: "object" }
                      }
                    },
                    {
                      type: "object",
                      properties: {
                        ok: { type: "boolean", enum: [false] },
                        error: { type: "string" }
                      }
                    }
                  ]
                }
              }
            }
          },
          "400": {
            description: "Invalid payload or bid",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    ok: { type: "boolean" },
                    error: { type: "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/v1/bid/log/{gameId}/{round}": {
      get: {
        summary: "Get bid log for a game round",
        tags: ["bidding"],
        parameters: [
          {
            name: "gameId",
            in: "path",
            required: true,
            schema: { type: "integer" }
          },
          {
            name: "round",
            in: "path",
            required: true,
            schema: { type: "integer" }
          }
        ],
        responses: {
          "200": {
            description: "Bid log for the round",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    gameId: { type: "integer" },
                    round: { type: "integer" },
                    bids: {
                      type: "array",
                      items: { type: "object" }
                    }
                  }
                }
              }
            }
          },
          "400": {
            description: "Invalid params"
          }
        }
      }
    }
  },
  components: {},
  // Swagger/OpenAPI does not natively model Socket.io, but we document
  // the events here as an extension for developers.
  "x-socketio": {
    namespace: "/",
    events: {
      submitBid: {
        description:
          "Submit a signed bid over Socket.io. Payload is the same as POST /api/v1/bid/submit.",
        payload: {
          type: "object",
          required: ["message", "signature"],
          properties: {
            message: {
              $ref: "#/paths/~1api~1v1~1bid~1submit/post/requestBody/content/application~1json/schema/properties/message"
            },
            signature: { type: "string" }
          }
        },
        ack: {
          type: "object",
          oneOf: [
            {
              properties: {
                ok: { type: "boolean", enum: [true] },
                bid: { type: "object" }
              }
            },
            {
              properties: {
                ok: { type: "boolean", enum: [false] },
                error: { type: "string" }
              }
            }
          ]
        }
      },
      highestBidUpdate: {
        description:
          "Broadcast from server when a new highest bid is accepted.",
        payload: {
          type: "object",
          properties: {
            amount: { type: "integer" },
            bidder: { type: "string", nullable: true }
          }
        }
      },
      gameStarted: {
        description: "Emitted when a new game starts.",
        payload: {
          type: "object",
          properties: {
            gameId: { type: "integer" },
            totalCards: { type: "integer" },
            firstCard: { type: "object" }
          }
        }
      },
      roundStarted: {
        description: "Emitted when a new round starts.",
        payload: {
          type: "object",
          properties: {
            gameId: { type: "integer" },
            round: { type: "integer" },
            card: { type: "object" }
          }
        }
      },
      gameFinished: {
        description: "Emitted when the game finishes.",
        payload: {
          type: "object",
          properties: {
            gameId: { type: "integer" }
          }
        }
      }
    }
  }
} as OpenAPIV3.Document & { "x-socketio"?: any };


