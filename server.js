const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use('/W/videochat', express.static(path.join(__dirname, 'public')));

const users = {};

io.on('connection', (socket) => {
  socket.on('join', ({ room, username }) => {
    socket.join(room);
    users[socket.id] = { room, username };

    // Send current user list to the new user
    const userList = [...(io.sockets.adapter.rooms.get(room) || [])]
      .filter(id => id !== socket.id)
      .map(id => ({ id, username: users[id]?.username || "Unknown" }));
    socket.emit('joined', { users: userList });

    // Notify others
    socket.to(room).emit('user-joined', { id: socket.id, username });

    socket.on('signal', ({ to, data }) => {
      io.to(to).emit('signal', { from: socket.id, data });
    });

    socket.on('chat', ({ user, text }) => {
      const roomId = users[socket.id]?.room;
      if (roomId) {
        socket.to(roomId).emit('chat', { user, text });
      }
    });

    socket.on('disconnect', () => {
      const user = users[socket.id];
      if (user) {
        socket.to(user.room).emit('user-left', { id: socket.id, username: user.username });
        delete users[socket.id];
      }
    });
  });
});


// Fallback routing for SPA
app.get('/W/videochat/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/', (req, res) => {
  res.redirect('/W/videochat');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
