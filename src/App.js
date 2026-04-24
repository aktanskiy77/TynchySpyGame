import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, update, remove, onDisconnect, push, runTransaction, get } from "firebase/database";
import './index.css';

// Твой конфиг Firebase
const firebaseConfig = {
  apiKey: "AIzaSyB-u8gX3VpYzP5pNgq7uxWZr-789hVK1o8",
  authDomain: "tynchyspy.firebaseapp.com",
  projectId: "tynchyspy",
  storageBucket: "tynchyspy.firebasestorage.app",
  messagingSenderId: "68942418862",
  appId: "1:68942418862:web:4c4949e7224b3b980b2e3f",
  measurementId: "G-1RYWB2DMKK",
  databaseURL: "https://tynchyspy-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const CATEGORIES = {
  "Кыргызстан": ["Боорсок", "Бешбармак", "Кымыз", "Ош Базары", "Иссык-Куль", "Маршрутка", "ЦУМ", "Джайлоо", "Супара", "Ала-Арча", "Ак-Кеме", "Көк-Бөрү"],
  "Өлкөлөр": ["Франция", "Япония", "Бразилия", "Египет", "АКШ", "Италия", "Кытай", "Австралия", "Канада", "Мексика", "Германия", "Түркия"],
  "Тамак-аш": ["Пицца", "Суши", "Бургер", "Лагман", "Плов", "Манты", "Шаурма", "Балмуздак", "Торт", "Стейк", "Паста"],
  "Кесиптер": ["Доктур", "Мугалим", "Ашпозчу", "Программист", "Космонавт", "Милиция", "Судья", "Учкуч", "Блогер", "Актер"]
};

function App() {
  const [name, setName] = useState(''); 
  const [room, setRoom] = useState('');
  const [joined, setJoined] = useState(false);
  const [players, setPlayers] = useState({});
  const [gameState, setGameState] = useState('lobby');
  const [role, setRole] = useState('');
  const [showRole, setShowRole] = useState(false);
  const [admin, setAdmin] = useState('');
  const [votes, setVotes] = useState({});
  const [selectedCategory, setSelectedCategory] = useState('Кыргызстан');
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [lastResult, setLastResult] = useState('');
  const [kickedPlayers, setKickedPlayers] = useState([]); 
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (joined && room) {
      const roomRef = ref(db, `rooms/${room}`);
      const playerRef = ref(db, `rooms/${room}/players/${name}`);

      // Самоочистка при выходе
      onDisconnect(playerRef).remove();

      return onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          // Если игроков нет — удаляем комнату полностью
          if (!data.players || Object.keys(data.players).length === 0) {
            remove(roomRef);
            return;
          }

          setPlayers(data.players || {});
          setGameState(data.state || 'lobby');
          setAdmin(data.admin || '');
          setVotes(data.votes || {});
          setLastResult(data.lastResult || '');
          
          const kicked = data.kickedPlayers ? Object.values(data.kickedPlayers) : [];
          setKickedPlayers(kicked);
          
          if (data.category) setSelectedCategory(data.category);
          setMessages(data.chat ? Object.values(data.chat) : []);
          if (data.assignments && data.assignments[name]) setRole(data.assignments[name]);

          // Передача админки если текущий админ вышел
          if (data.admin === name && !data.players[name]) {
             const others = Object.keys(data.players);
             if (others.length > 0) update(roomRef, { admin: others[0] });
          }
        }
      });
    }
  }, [joined, room, name]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const joinRoom = async () => {
    if (name.trim() && room.trim()) {
      const adminRef = ref(db, `rooms/${room}/admin`);
      
      // Транзакция: админом станет только первый
      await runTransaction(adminRef, (current) => {
        return current === null ? name : current;
      });

      await set(ref(db, `rooms/${room}/players/${name}`), { name });
      setJoined(true);
    }
  };

  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    push(ref(db, `rooms/${room}/chat`), { user: name, text: inputText });
    setInputText('');
  };

  const startGame = () => {
    const playerNames = Object.keys(players);
    if (playerNames.length < 3) return alert("Кеминде 3 оюнчу керек!");
    
    const spyName = playerNames[Math.floor(Math.random() * playerNames.length)];
    const word = CATEGORIES[selectedCategory][Math.floor(Math.random() * CATEGORIES[selectedCategory].length)];
    
    const assignments = {};
    playerNames.forEach(p => { assignments[p] = (p === spyName) ? "ТЫНЧЫ 🕵️‍♂️" : word; });

    update(ref(db, `rooms/${room}`), { 
      state: 'started', 
      assignments, 
      votes: {}, 
      lastResult: '',
      kickedPlayers: null 
    });
    setShowRole(false);
  };

  const handleVote = async () => {
    if (name !== admin) return;
    const voteCounts = {};
    Object.values(votes).forEach(v => voteCounts[v] = (voteCounts[v] || 0) + 1);
    let kicked = Object.keys(voteCounts).reduce((a, b) => (voteCounts[a] > voteCounts[b] ? a : b), null);
    
    if (!kicked) return alert("Эч ким тандалган жок!");

    const snap = await get(ref(db, `rooms/${room}/assignments/${kicked}`));
    const kickedRole = snap.val();

    if (kickedRole === "ТЫНЧЫ 🕵️‍♂️") {
      update(ref(db, `rooms/${room}`), { 
        state: 'lobby', 
        lastResult: `ЖЕҢИШ! 🎉 Шпион табылды: ${kicked}.`,
        votes: {},
        assignments: null,
        kickedPlayers: null
      });
    } else {
      const currentKicked = [...kickedPlayers, kicked];
      update(ref(db, `rooms/${room}`), { 
        state: 'started', 
        votes: {},
        kickedPlayers: currentKicked,
        lastResult: `${kicked} шпион эмес болчу! Ал эми байкоочу.` 
      });
    }
  };

  if (!joined) return (
    <div className="container">
      <h1 className="logo">TynchySpy</h1>
      <div className="box">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Атың ким?" />
        <input value={room} onChange={e => setRoom(e.target.value)} placeholder="Бөлмө коду" />
        <button className="btn-main" onClick={joinRoom}>КИРҮҮ</button>
      </div>
    </div>
  );

  const isObserver = kickedPlayers.includes(name);

  return (
    <div className="container">
      <div className="header">
        <div className="room-badge">Бөлмө: {room}</div>
        {isObserver && <div className="observer-badge">Байкоочу 👀</div>}
        <button className="btn-exit" onClick={() => window.location.reload()}>Чыгуу</button>
      </div>

      {gameState === 'lobby' && (
        <div className="box">
          {lastResult && <div className="result-banner">{lastResult}</div>}
          <h3 className="section-title">Оюнчулар ({Object.keys(players).length}):</h3>
          <div className="grid">
            {Object.keys(players).map(p => (
              <div key={p} className={`card ${p === admin ? 'admin-border' : ''} ${kickedPlayers.includes(p) ? 'is-kicked' : ''}`}>
                {p} {p === admin && "⭐"}
              </div>
            ))}
          </div>
          {name === admin && (
            <div className="admin-panel">
              <p>Тема:</p>
              <div className="category-grid">
                {Object.keys(CATEGORIES).map(cat => (
                  <button key={cat} className={`cat-btn ${selectedCategory === cat ? 'active' : ''}`} onClick={() => update(ref(db, `rooms/${room}`), {category: cat})}>{cat}</button>
                ))}
              </div>
              <button className="btn-main" onClick={startGame}>Оюнду баштоо</button>
            </div>
          )}
        </div>
      )}

      {gameState === 'started' && (
        <div className="box">
          {!isObserver ? (
            <>
              <div className="role-card" onClick={() => setShowRole(!showRole)}>
                {showRole ? <div className="role-reveal"><p>Ролуңуз:</p><h2 className="role-text">{role}</h2></div> : <h2>Ролду көрүү 👀</h2>}
              </div>
              <p className="topic-hint">Тема: <b>{selectedCategory}</b></p>
            </>
          ) : (
            <div className="observer-screen"><h3>Сиз байкоочусуз</h3><p>Оюнду чаттан байкаңыз.</p></div>
          )}
          {lastResult && <div className="mini-result">{lastResult}</div>}
          {name === admin && <button className="btn-main" onClick={() => update(ref(db, `rooms/${room}`), {state: 'voting'})}>Добуш берүүгө өтүү</button>}
        </div>
      )}

      {gameState === 'voting' && (
        <div className="box">
          <h3 className="section-title">Ким шпион?</h3>
          <div className="grid">
            {Object.keys(players).map(p => {
              if (kickedPlayers.includes(p)) return null;
              return (
                <button key={p} disabled={isObserver || p === name} className={`card ${votes[name] === p ? 'active' : ''}`} onClick={() => update(ref(db, `rooms/${room}/votes`), {[name]: p})}>
                  {p} ({Object.values(votes).filter(v => v === p).length} 🗳️)
                </button>
              );
            })}
          </div>
          {name === admin && <button className="btn-kick" onClick={handleVote}>Натыйжаны текшерүү</button>}
        </div>
      )}

      <div className="chat-container">
        <div className="chat-messages">
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.user === name ? 'my' : ''}`}><b>{m.user}:</b> {m.text}</div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <form onSubmit={sendMessage} className="chat-input">
          <input value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Жазуу..." />
          <button type="submit">⬆️</button>
        </form>
      </div>
    </div>
  );
}

export default App;