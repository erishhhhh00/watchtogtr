# Watch-With-Friends API Documentation

## Base URL
`http://localhost:3001/api`

## Authentication Endpoints

### Register User
**POST** `/auth/register`

Request:
```json
{
  "username": "string (3-20 chars)",
  "email": "string (optional)",
  "password": "string (min 6 chars)"
}
```

Response:
```json
{
  "user": {
    "id": "uuid",
    "username": "string",
    "email": "string",
    "isGuest": false
  },
  "token": "jwt-token"
}
```

### Login
**POST** `/auth/login`

Request:
```json
{
  "username": "string",
  "password": "string"
}
```

Response:
```json
{
  "user": {
    "id": "uuid",
    "username": "string",
    "isGuest": false
  },
  "token": "jwt-token"
}
```

### Guest Join
**POST** `/auth/guest`

Request:
```json
{
  "username": "string (min 3 chars)"
}
```

Response:
```json
{
  "user": {
    "id": "uuid",
    "username": "string_XXXX",
    "isGuest": true
  },
  "token": "jwt-token"
}
```

## Room Endpoints

### Create Room
**POST** `/rooms`

Request:
```json
{
  "name": "string (3-50 chars)",
  "hostId": "uuid",
  "maxParticipants": "number (2-50, default 10)"
}
```

Response:
```json
{
  "room": {
    "id": "uuid",
    "hostId": "uuid",
    "name": "string",
    "participants": ["uuid"],
    "playbackState": {
      "url": "",
      "currentTime": 0,
      "isPlaying": false,
      "lastUpdated": 1234567890,
      "videoType": "mp4"
    },
    "chatHistory": [],
    "createdAt": "ISO-8601",
    "maxParticipants": 10
  }
}
```

### Get Room
**GET** `/rooms/:roomId`

Response:
```json
{
  "room": { /* room object */ }
}
```

### Join Room
**POST** `/rooms/:roomId/join`

Request:
```json
{
  "userId": "uuid"
}
```

Response:
```json
{
  "room": { /* room object */ }
}
```

## Socket.IO Events

### Client → Server

#### join-room
```json
{
  "roomId": "uuid",
  "userId": "uuid",
  "username": "string"
}
```

#### play
```json
{
  "roomId": "uuid"
}
```

#### pause
```json
{
  "roomId": "uuid",
  "currentTime": "number (seconds)"
}
```

#### seek
```json
{
  "roomId": "uuid",
  "currentTime": "number (seconds)"
}
```

#### change-source
```json
{
  "roomId": "uuid",
  "url": "string",
  "videoType": "mp4|hls|youtube|vimeo"
}
```

#### chat-message
```json
{
  "roomId": "uuid",
  "message": "string (max 500 chars)"
}
```

#### webrtc-offer
```json
{
  "roomId": "uuid",
  "offer": "RTCSessionDescription",
  "targetUserId": "uuid (optional)"
}
```

#### webrtc-answer
```json
{
  "roomId": "uuid",
  "answer": "RTCSessionDescription",
  "targetUserId": "uuid"
}
```

#### webrtc-ice-candidate
```json
{
  "roomId": "uuid",
  "candidate": "RTCIceCandidate",
  "targetUserId": "uuid"
}
```

#### kick-user
```json
{
  "roomId": "uuid",
  "userId": "uuid"
}
```

### Server → Client

#### room-state
```json
{
  "room": { /* room object */ },
  "participants": [
    {
      "userId": "uuid",
      "username": "string",
      "isHost": "boolean",
      "isMuted": "boolean"
    }
  ],
  "serverTime": "number (timestamp)"
}
```

#### sync-state
Sent every 5 seconds and on playback changes
```json
{
  "playbackState": {
    "url": "string",
    "currentTime": "number",
    "isPlaying": "boolean",
    "lastUpdated": "number (server timestamp)",
    "videoType": "string"
  },
  "serverTime": "number (timestamp)"
}
```

#### user-joined
```json
{
  "userId": "uuid",
  "username": "string",
  "isHost": "boolean",
  "serverTime": "number"
}
```

#### user-left
```json
{
  "userId": "uuid",
  "username": "string",
  "serverTime": "number"
}
```

#### chat-message
```json
{
  "id": "uuid",
  "userId": "uuid",
  "username": "string",
  "message": "string",
  "timestamp": "number"
}
```

#### webrtc-offer
```json
{
  "offer": "RTCSessionDescription",
  "fromUserId": "uuid",
  "fromUsername": "string"
}
```

#### webrtc-answer
```json
{
  "answer": "RTCSessionDescription",
  "fromUserId": "uuid"
}
```

#### webrtc-ice-candidate
```json
{
  "candidate": "RTCIceCandidate",
  "fromUserId": "uuid"
}
```

#### kicked
```json
{
  "message": "string"
}
```

#### error
```json
{
  "message": "string"
}
```

## Rate Limits

- General API: 100 requests per 15 minutes
- Auth endpoints: 5 attempts per 15 minutes
- Room creation: 10 rooms per hour

## Error Responses

```json
{
  "status": "error",
  "message": "Error description"
}
```

Common HTTP status codes:
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 409: Conflict
- 429: Too Many Requests
- 500: Internal Server Error
