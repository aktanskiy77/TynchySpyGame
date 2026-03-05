import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, update, remove, onDisconnect } from "firebase/database";
import './index.css';

// Сенин Firebase конфигиң
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
  const [currentCategory, setCurrentCategory] = useState('');

  const allCategoryKeys = [...Object.keys(CATEGORIES), "Баардыгы", "Оюнчулар"];

  // Негизги угуучу (Listener)
  useEffect(() => {
    if (joined && room) {
      const roomRef = ref(db, `rooms/${room}`);
      
      // Байланыш үзүлгөндө оюнчуну автоматтык түрдө өчүрүү
      const playerRef = ref(db, `rooms/${room}/players/${name}`);
      onDisconnect(playerRef).remove();

      return onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          setPlayers(data.players || {});
          setGameState(data.state || 'lobby');
          setAdmin(data.admin || '');
          setVotes(data.votes || {});
          setCurrentCategory(data.category || '');

          if (data.kicked === name) {
            alert("Сени көпчүлүк добуш менен чыгарып жиберишти! ⛔");
            exitRoom();
          }

          if (data.state === 'started' && data.assignments) {
            setRole(data.assignments[name] || '');
          }
        }
      });
    }
  }, [joined, room, name]);

  const joinRoom = () => {
    if (name.trim() && room.trim()) {
      const roomRef = ref(db, `rooms/${room}`);
      onValue(roomRef, (snapshot) => {
        const data = snapshot.val();
        if (!data || !data.admin) {
          update(ref(db, `rooms/${room}`), { admin: name });
        }
      }, { onlyOnce: true });
      set(ref(db, `rooms/${room}/players/${name}`), { name });
      setJoined(true);
    }
  };

  const exitRoom = () => {
    if (!room || !name) return;
    const playerRef = ref(db, `rooms/${room}/players/${name}`);
    const roomRef = ref(db, `rooms/${room}`);

    remove(playerRef).then(() => {
      onValue(ref(db, `rooms/${room}/players`), (snapshot) => {
        if (!snapshot.exists()) {
          remove(roomRef); // Акыркы адам чыкса бөлмөнү өчүрүү
        }
      }, { onlyOnce: true });
    });

    setJoined(false);
    setRoom('');
    setName('');
    setRole('');
    setShowRole(false);
  };

  const startGame = () => {
    if (name !== admin) return;
    const playerNames = Object.keys(players);
    if (playerNames.length < 3) return alert("Минимум 3 оюнчу керек!");

    let finalCategory = selectedCategory;
    let wordList = [];

    if (selectedCategory === "Баардыгы") {
      const themes = Object.keys(CATEGORIES);
      finalCategory = themes[Math.floor(Math.random() * themes.length)];
      wordList = CATEGORIES[finalCategory];
    } else if (selectedCategory === "Оюнчулар") {
      wordList = playerNames;
      finalCategory = "Оюнчулардын аттары";
    } else {
      wordList = CATEGORIES[selectedCategory];
    }

    const spyName = playerNames[Math.floor(Math.random() * playerNames.length)];
    const word = wordList[Math.floor(Math.random() * wordList.length)];
    const assignments = {};
    
    playerNames.forEach(p => {
      assignments[p] = (p === spyName) ? "ШПИОН 🕵️‍♂️" : word;
    });

    update(ref(db, `rooms/${room}`), { 
      state: 'started', 
      assignments, 
      category: finalCategory,
      votes: {},
      kicked: null 
    });
  };

  const goToVoting = () => {
    if (name !== admin) return;
    update(ref(db, `rooms/${room}`), { state: 'voting' });
  };

  const kickAndReset = () => {
    if (name !== admin) return;
    const voteCounts = {};
    Object.values(votes).forEach(target => {
      voteCounts[target] = (voteCounts[target] || 0) + 1;
    });

    let winner = null;
    let maxVotes = 0;
    for (const [player, count] of Object.entries(voteCounts)) {
      if (count > maxVotes) {
        maxVotes = count;
        winner = player;
      }
    }

    update(ref(db, `rooms/${room}`), { 
      kicked: winner,
      state: 'lobby',
      assignments: null,
      votes: {}
    });
    setTimeout(() => update(ref(db, `rooms/${room}`), { kicked: null }), 2000);
    setShowRole(false);
  };

  if (!joined) {
    return (
      <div className="container">
        <h1 className="logo">TynchySpy</h1>
        <div className="input-group">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Сенин атың" />
          <input value={room} onChange={e => setRoom(e.target.value)} placeholder="Бөлмө коду" />
          <button className="btn-join" onClick={joinRoom}>Кирүү</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <span>Бөлмө: <b>{room}</b> | Админ: <b>{admin}</b></span>
        <button className="btn-exit" onClick={exitRoom}>Чыгуу</button>
      </div>

      {gameState === 'lobby' && (
        <div className="lobby">
          <h2>Оюнчулар ({Object.keys(players).length}):</h2>
          <div className="player-grid">
            {Object.keys(players).map(p => (
              <div key={p} className={`player-card ${p === admin ? 'admin-border' : ''}`}>
                {p} {p === admin && "⭐"}
              </div>
            ))}
          </div>
          
          {name === admin && (
            <div className="category-section">
              <p>Теманы тандаңыз:</p>
              <div className="category-grid">
                {allCategoryKeys.map(cat => (
                  <button key={cat} className={`cat-btn ${selectedCategory === cat ? 'active' : ''}`} onClick={() => setSelectedCategory(cat)}>{cat}</button>
                ))}
              </div>
              <button className="btn-start" onClick={startGame}>Оюнду баштоо</button>
            </div>
          )}
        </div>
      )}

      {gameState === 'started' && (
        <div className="game-box">
          {!showRole ? (
            <button className="btn-reveal" onClick={() => setShowRole(true)}>Сөздү көрүү</button>
          ) : (
            <div className="role-display" onClick={() => setShowRole(false)}>
              <p>Сенин ролуң:</p>
              <h2 className={role === 'ТЫНЧЫ 🕵️‍♂️' ? 'spy' : 'word'}>{role}</h2>
              <span className="hint">(Жашыруу үчүн басыңыз)</span>
            </div>
          )}
          
          <div className="spy-help">
            <p>Тема: <b>{currentCategory}</b></p>
            {role === 'ШПИОН 🕵️‍♂️' && (
              <div className="word-list">
                <p>Мүмкүн болгон сөздөр:</p>
                <span>
                  {currentCategory === "Оюнчулардын аттары" 
                    ? Object.keys(players).join(", ") 
                    : CATEGORIES[currentCategory]?.join(", ")}
                </span>
              </div>
            )}
          </div>

          {name === admin && <button className="btn-vote-trigger" onClick={goToVoting}>Голосование</button>}
        </div>
      )}

      {gameState === 'voting' && (
        <div className="voting-screen">
          <h2>Ким шпион?</h2>
          <div className="player-grid">
            {Object.keys(players).map(p => (
              <button key={p} className={`player-card vote-btn ${votes[name] === p ? 'voted' : ''}`} onClick={() => update(ref(db, `rooms/${room}/votes`), { [name]: p })} disabled={p === name}>
                {p} <div className="vote-count">{Object.values(votes).filter(v => v === p).length} 🗳️</div>
              </button>
            ))}
          </div>
          {name === admin && <button className="btn-kick" onClick={kickAndReset}>Натыйжа жана КИК</button>}
        </div>
      )}
    </div>
  );
}

export default App;