const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const PORT = process.env.PORT || 3000;

let rooms = {};

function generateSequence() {
  return Array.from({ length: 100 }, () => Math.floor(Math.random() * 6) + 1);
}

function initialTokens() {
  return Array.from({ length: 4 }, (_, i) => ({ id: i, pos: -1, done: false }));
}

function createRoom(id) {
  rooms[id] = {
    players: [],
    turn: 0,
    sequence: generateSequence(),
    seqIndex: 0,
    tokens: {},
    colors: ['red','blue','green','yellow'],
    winner: null
  };
}

function startIndex(i){ return [0,13,26,39][i]; }
function safeTiles(){ return [0,8,13,21,26,34,39,47]; }

io.on('connection', socket => {

  socket.on('join', roomId => {
    if (!rooms[roomId]) createRoom(roomId);
    const room = rooms[roomId];

    if (room.players.length >= 4) return;

    room.players.push(socket.id);
    room.tokens[socket.id] = initialTokens();

    socket.join(roomId);
    socket.emit('init', room);
    io.to(roomId).emit('state', room);
  });

  socket.on('move', ({ roomId, tokenId }) => {
    const room = rooms[roomId];
    if (!room || room.winner) return;

    const pIndex = room.players.indexOf(socket.id);
    if (pIndex !== room.turn) return;

    const num = room.sequence[room.seqIndex];
    const token = room.tokens[socket.id][tokenId];

    if (token.done) return;

    if (token.pos === -1 && num === 6) token.pos = startIndex(pIndex);
    else if (token.pos >= 0 && token.pos + num < 52) token.pos += num;

    room.players.forEach(pid => {
      if (pid === socket.id) return;
      room.tokens[pid].forEach(t => {
        if (t.pos === token.pos && !safeTiles().includes(token.pos)) {
          t.pos = -1;
          io.to(roomId).emit('sound', 'kill');
        }
      });
    });

    if (token.pos === 51) token.done = true;

    if (room.tokens[socket.id].every(t => t.done)) {
      room.winner = socket.id;
      io.to(roomId).emit('sound', 'win');
    }

    room.seqIndex++;
    room.turn = (room.turn + 1) % room.players.length;

    io.to(roomId).emit('state', room);
  });

  socket.on('restart', roomId => {
    createRoom(roomId);
    io.to(roomId).emit('state', rooms[roomId]);
  });

});

server.listen(PORT, () => console.log("Server running"));
