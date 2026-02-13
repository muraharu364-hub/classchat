import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  serverTimestamp, 
  deleteDoc, 
  updateDoc, 
  doc 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithPopup, 
  GoogleAuthProvider, 
  GithubAuthProvider, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  Hash, Send, LogOut, Github, Chrome, AlertCircle, 
  Trash2, Plus, MessageSquare, ArrowLeft, Users, Lock, 
  Sparkles, Heart, Bot, Info, Bell, Reply, X,
  ChevronLeft, ChevronRight, Calendar, Smile, 
  ImagePlus, XCircle, Loader2 
} from 'lucide-react';

// ==========================================
// 👇 ここにあなたのFirebase設定を貼り付けてください
// ==========================================
const manualConfig = {
  apiKey: "AIzaSyATsr01BJ6RihOW5SUhW4aXfx7SOdaxSd0",
  authDomain: "classhub-d8c5f.firebaseapp.com",
  projectId: "classhub-d8c5f",
  storageBucket: "classhub-d8c5f.firebasestorage.app",
  messagingSenderId: "1015431116758",
  appId: "1:1015431116758:web:f647345b8610eea810d677",
  measurementId: "G-TLD75RQYVX"
};
// ==========================================

const isConfigValid = (config) => {
  return config && config.apiKey && config.apiKey !== "ここにapiKeyを貼り付け";
};

let app = null;
let auth = null;
let db = null;

try {
  if (isConfigValid(manualConfig)) {
    app = initializeApp(manualConfig);
  } else if (typeof __firebase_config !== 'undefined') {
    app = initializeApp(JSON.parse(__firebase_config));
  }
  
  if (app) {
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (e) {
  console.error("Firebase Init Error:", e);
}

const appId = isConfigValid(manualConfig) 
  ? 'class-hub-production' 
  : (typeof __app_id !== 'undefined' ? __app_id.replace(/[\/\.]/g, '_') : 'class-hub-production');

const aiTopics = [
  "今日のお昼ご飯、何食べた？🍚",
  "最近ハマってるYouTubeチャンネルは？📺",
  "もし100万円もらえたら何に使う？💰",
  "今週末の予定は？📅",
  "おすすめのスマホアプリ教えて！📱",
  "最近あった面白いこと🤣",
  "好きな教科・苦手な教科は？📚",
  "最近聴いてる音楽は？🎵",
  "テスト勉強の進み具合どう？📝",
  "犬派？猫派？🐶🐱"
];

const appUpdates = [
  { id: 1, date: "2/13", text: "長いルーム名が自動でスクロールするようになりました！↔️" },
  { id: 2, date: "2/13", text: "スマホの「戻る」ボタンで退室できるようになりました！📱" },
  { id: 3, date: "2/12", text: "メッセージに「画像🖼️」を添付できるようになりました！" }
];

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

const compressImage = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new window.Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// 👇 自動スクロールタイトルのコンポーネント
const ScrollingTitle = ({ text, className, containerClass }) => {
  // 15文字以上ならスクロールさせる
  const isLong = text.length > 15;

  if (!isLong) {
    return (
      <div className={`min-w-0 ${containerClass}`}>
        <h3 className={`truncate ${className}`}>{text}</h3>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${containerClass}`}>
      <div className="flex w-max animate-scroll-text">
        <h3 className={`${className} mr-8`}>{text}</h3>
        <h3 className={`${className} mr-8`}>{text}</h3>
      </div>
    </div>
  );
};

const App = () => {
  if (!auth || !db) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-blue-50 p-6 text-center font-sans text-gray-700 w-full overflow-hidden">
        <div className="bg-white p-10 rounded-[3rem] shadow-xl max-w-md w-full border-4 border-white">
          <AlertCircle size={64} className="text-blue-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">設定が必要です☁️</h2>
          <p className="text-gray-500 mb-6 text-sm">
            コードの <code>manualConfig</code> の部分に<br/>
            Firebaseの設定を貼り付けてね！
          </p>
        </div>
      </div>
    );
  }

  const [user, setUser] = useState(null);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [allMessages, setAllMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [newRoomTopic, setNewRoomTopic] = useState("");
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [error, setError] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const [selectedImage, setSelectedImage] = useState(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [zoomedImage, setZoomedImage] = useState(null);
  const fileInputRef = useRef(null);

  const messagesEndRef = useRef(null);

  const currentMessages = allMessages
    .filter(msg => msg.roomId === currentRoom?.id)
    .sort((a, b) => (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0));

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages.length]);

  useEffect(() => {
    setReplyingTo(null);
    setSelectedImage(null);
    setActiveReactionMsgId(null);
  }, [currentRoom]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoom(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const enterRoom = (room) => {
    setCurrentRoom(room);
    window.history.pushState({ roomId: room.id }, '', '#room');
  };

  const leaveRoom = () => {
    window.history.back();
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setError(null);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    try {
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'rooms'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const roomList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const topicIndex = (today.getFullYear() + today.getMonth() + today.getDate()) % aiTopics.length;
        const aiRoomId = `ai-room-${todayStr}`;

        if (!roomList.some(r => r.id === aiRoomId)) {
          roomList.push({
            id: aiRoomId,
            topic: `🤖 今日の話題: ${aiTopics[topicIndex]}`,
            createdBy: "AIアシスタント",
            creatorId: "ai-system",
            createdAt: { 
              toMillis: () => new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime(),
              toDate: () => new Date(today.getFullYear(), today.getMonth(), today.getDate())
            },
            isAi: true
          });
        }

        roomList.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setRooms(roomList);
      }, (err) => {
        if (err.code === 'permission-denied') setError("PERMISSION_DENIED");
      });
      return () => unsubscribe();
    } catch (e) { console.error(e); }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    try {
      const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'messages'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllMessages(msgs);
      }, (err) => console.error(err));
      return () => unsubscribe();
    } catch (e) { console.error(e); }
  }, [user]);

  const getDateString = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const selectedDateStr = getDateString(selectedDate);
  const todayStr = getDateString(new Date());

  const getRoomDateStr = (room) => {
    if (room.createdAt?.toDate) {
      return getDateString(room.createdAt.toDate());
    } else if (room.createdAt?.toMillis) {
      return getDateString(new Date(room.createdAt.toMillis()));
    }
    return todayStr; 
  };

  const filteredRooms = rooms.filter(room => getRoomDateStr(room) === selectedDateStr);

  const changeDate = (days) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  const getDisplayDate = () => {
    if (selectedDateStr === todayStr) return "今日のルーム";
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (selectedDateStr === getDateString(yesterday)) return "昨日のルーム";
    return `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日`;
  };

  const handleLogin = async (loginMethod) => {
    setError(null);
    try {
      await loginMethod();
    } catch (err) {
      if (err.code === 'auth/unauthorized-domain') {
        setError("URLの許可が必要です！Firebaseで設定してね。");
      } else {
        setError("ログインできませんでした😢 iPhoneの方は下の「ゲスト」で入ってみてね！");
      }
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomTopic.trim()) return;
    try {
      const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'rooms'), {
        topic: newRoomTopic,
        createdBy: user.displayName || "ゲスト",
        creatorId: user.uid,
        createdAt: serverTimestamp()
      });
      setSelectedDate(new Date()); 
      enterRoom({ id: docRef.id, topic: newRoomTopic });
      setNewRoomTopic("");
      setIsCreatingRoom(false);
    } catch (err) {
      setError("ルームが作れませんでした😢");
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      alert("画像ファイルを選択してください！");
      return;
    }

    setIsCompressing(true);
    try {
      const compressedBase64 = await compressImage(file);
      setSelectedImage(compressedBase64);
    } catch (err) {
      console.error("画像圧縮エラー:", err);
      alert("画像の処理に失敗しました😢");
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() && !selectedImage) return;

    try {
      const messageData = {
        roomId: currentRoom.id,
        userId: user.uid,
        user: user.displayName || `ゲスト`,
        userPhoto: user.photoURL,
        content: inputText,
        imageUrl: selectedImage || null,
        createdAt: serverTimestamp(),
        reactions: {}
      };

      if (replyingTo) {
        messageData.replyTo = {
          id: replyingTo.id,
          user: replyingTo.user,
          content: replyingTo.content,
          hasImage: !!replyingTo.imageUrl
        };
      }

      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'messages'), messageData);
      
      setInputText("");
      setSelectedImage(null);
      setReplyingTo(null);
      setError(null);
    } catch (err) {
      if (err.message.includes('Document size')) {
        setError("ごめんね、画像サイズが大きすぎます！別の画像にしてね😢");
      } else {
        setError("送信失敗... " + err.message);
      }
    }
  };

  const deleteMessage = async (id) => {
    if(window.confirm("このメッセージを消しちゃう？")) {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'messages', id));
    }
  };

  const toggleReaction = async (messageId, emoji) => {
    try {
      const msgRef = doc(db, 'artifacts', appId, 'public', 'data', 'messages', messageId);
      const msg = allMessages.find(m => m.id === messageId);
      if (!msg) return;

      const currentReactions = msg.reactions || {};
      const usersWhoReacted = currentReactions[emoji] || [];
      
      let newUsers;
      if (usersWhoReacted.includes(user.uid)) {
        newUsers = usersWhoReacted.filter(uid => uid !== user.uid);
      } else {
        newUsers = [...usersWhoReacted, user.uid];
      }

      const newReactions = { ...currentReactions, [emoji]: newUsers };
      
      if (newUsers.length === 0) {
        delete newReactions[emoji];
      }

      await updateDoc(msgRef, { reactions: newReactions });
    } catch (err) {
      console.error("リアクションエラー:", err);
    }
  };

  if (error === "PERMISSION_DENIED") {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-red-50 p-6 text-center font-sans w-full overflow-hidden">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full">
          <Lock size={64} className="text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">カギがかかっています🔒</h1>
          <p className="text-gray-500 text-sm">Firebaseの「ルール」設定を公開済みにしてね！</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-100 via-indigo-50 to-purple-100 p-6 font-sans w-full overflow-hidden">
        <div className="bg-white/80 backdrop-blur-xl p-10 rounded-[3rem] shadow-[0_20px_60px_rgba(100,149,237,0.2)] w-full max-w-sm text-center border-4 border-white">
          <div className="bg-gradient-to-tr from-blue-400 to-indigo-400 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-200">
            <Heart size={48} className="text-white fill-white animate-pulse" />
          </div>
          <h1 className="text-4xl font-black mb-2 text-gray-800 tracking-tight">ClassHub</h1>
          <p className="text-gray-500 mb-6 font-bold text-sm">クラスのみんなとつながろう✨</p>
          
          <div className="bg-blue-50 border-l-4 border-blue-400 p-3 mb-6 rounded-r-xl text-left shadow-sm">
            <p className="text-xs text-blue-800 font-bold mb-1 flex items-center gap-1">
              <Info size={14}/> iPhone・LINEから開いた方へ
            </p>
            <p className="text-[10px] text-blue-700 leading-tight">
              セキュリティによりGoogleログインができない場合があります。その時は一番下の<span className="font-bold">「登録せずにのぞいてみる」</span>から参加してね！
            </p>
          </div>

          {error && <div className="mb-6 p-3 bg-red-100 text-red-500 text-xs rounded-xl font-bold">{error}</div>}

          <div className="flex flex-col gap-3">
            <button onClick={() => handleLogin(() => signInWithPopup(auth, new GoogleAuthProvider()))} className="group flex items-center justify-center gap-3 bg-white text-gray-700 py-3.5 rounded-2xl font-bold shadow-md hover:shadow-xl hover:-translate-y-1 transition-all border-2 border-transparent hover:border-blue-200">
              <Chrome size={20} className="text-blue-500" /> Googleで入る
            </button>
            <button onClick={() => handleLogin(() => signInWithPopup(auth, new GithubAuthProvider()))} className="group flex items-center justify-center gap-3 bg-gray-900 text-white py-3.5 rounded-2xl font-bold shadow-md hover:shadow-xl hover:-translate-y-1 transition-all">
              <Github size={20} /> GitHubで入る
            </button>
            
            <div className="mt-4 pt-4 border-t border-gray-100">
              <button onClick={() => handleLogin(() => signInAnonymously(auth))} className="w-full group flex items-center justify-center gap-2 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-600 py-3 rounded-2xl font-bold hover:shadow-md transition-all border border-blue-200">
                <Sparkles size={18} className="text-yellow-500 group-hover:animate-spin" /> 登録せずにのぞいてみる
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentRoom) {
    return (
      <div className="flex flex-col h-screen w-full overflow-x-hidden bg-[#F0F4F8] font-sans">
        
        {/* 👇 スクロールアニメーション用のスタイルを埋め込み */}
        <style>{`
          @keyframes scroll-text {
            0% { transform: translateX(0%); }
            100% { transform: translateX(-100%); }
          }
          .animate-scroll-text {
            animation: scroll-text 15s linear infinite;
          }
        `}</style>

        <header className="bg-white/80 backdrop-blur-md p-5 px-6 flex justify-between items-center sticky top-0 z-20 shadow-sm border-b border-white">
          <div className="flex items-center gap-2 font-black text-xl text-gray-800">
            <span className="bg-blue-100 p-2 rounded-full text-blue-500"><Hash size={20} /></span>
            ClassHub
          </div>
          <button onClick={() => signOut(auth)} className="bg-gray-100 hover:bg-gray-200 text-gray-500 p-3 rounded-full transition-colors">
            <LogOut size={20} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 max-w-2xl mx-auto w-full relative">
          
          <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-4 rounded-3xl mb-6 border border-yellow-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-16 h-16 bg-white/40 rounded-full blur-xl -mr-4 -mt-4"></div>
            <h3 className="text-sm font-black text-yellow-800 flex items-center gap-2 mb-3 relative z-10">
              <span className="bg-yellow-200 text-yellow-700 p-1.5 rounded-full"><Bell size={14} /></span>
              最新のアップデート
            </h3>
            <ul className="text-[11px] text-yellow-800/80 space-y-2 relative z-10 font-medium ml-1">
              {appUpdates.map(update => (
                <li key={update.id} className="flex gap-2.5 items-start">
                  <span className="font-bold opacity-60 shrink-0">{update.date}</span>
                  <span>{update.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-between items-center mb-6 bg-white p-2 rounded-[2rem] shadow-sm border border-blue-50 relative z-10">
            <button 
              onClick={() => changeDate(-1)} 
              className="p-3 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all active:scale-95"
            >
              <ChevronLeft size={24} />
            </button>
            
            <div className="flex flex-col items-center justify-center pointer-events-none">
              <div className="flex items-center gap-2 text-gray-800 font-black text-base">
                <Calendar size={18} className="text-blue-500" />
                {getDisplayDate()}
              </div>
              <span className="text-[10px] text-gray-400 font-bold tracking-widest mt-0.5">
                {selectedDateStr.replace(/-/g, '/')}
              </span>
            </div>

            <button 
              onClick={() => changeDate(1)} 
              disabled={selectedDateStr === todayStr}
              className={`p-3 rounded-full transition-all active:scale-95 ${selectedDateStr === todayStr ? 'text-gray-200 cursor-not-allowed' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
            >
              <ChevronRight size={24} />
            </button>
          </div>

          <div className="flex justify-between items-end mb-6">
            <div>
              <p className="text-xs text-gray-500 font-bold ml-1">この日の話題に参加しよう！</p>
            </div>
            <button 
              onClick={() => setIsCreatingRoom(!isCreatingRoom)} 
              className="bg-blue-500 text-white px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all shrink-0"
            >
              <Plus size={18} /> 作る
            </button>
          </div>

          {isCreatingRoom && (
            <div className="bg-white p-2 rounded-[2.5rem] shadow-xl mb-8 animate-in fade-in slide-in-from-top-4 border-4 border-blue-50">
              <form onSubmit={handleCreateRoom} className="flex gap-2 p-2 w-full">
                <input 
                  autoFocus
                  value={newRoomTopic}
                  onChange={(e) => setNewRoomTopic(e.target.value)}
                  placeholder="話題を入力（例：お昼なに食べた？）" 
                  className="flex-1 min-w-0 bg-gray-50 rounded-[2rem] px-4 sm:px-6 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all font-bold text-gray-700"
                />
                <button type="submit" className="bg-blue-500 text-white px-4 sm:px-6 shrink-0 rounded-[2rem] font-bold hover:bg-blue-600 transition-colors">OK</button>
              </form>
            </div>
          )}

          <div className="grid gap-4">
            {filteredRooms.length === 0 && (
               <div className="text-center py-20 opacity-50">
                 <Calendar size={60} className="mx-auto mb-4 text-gray-300" />
                 <p className="font-bold text-gray-400">この日のルームはありません💬</p>
               </div>
            )}
            
            {filteredRooms.map(room => {
              const roomRecentMsgs = allMessages
                .filter(msg => msg.roomId === room.id)
                .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
                .slice(0, 3)
                .reverse(); 

              return (
                <div 
                  key={room.id} 
                  onClick={() => enterRoom(room)} 
                  className="group bg-white p-5 sm:p-6 rounded-[2.5rem] shadow-sm border-2 border-transparent hover:border-blue-200 hover:shadow-xl cursor-pointer transition-all relative overflow-hidden flex flex-col justify-center w-full"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-bl-[4rem] -mr-8 -mt-8 group-hover:scale-110 transition-transform"></div>
                  
                  {/* 👇 自動スクロールタイトルを使用 */}
                  <div className="flex items-center gap-3 relative z-10 w-full mb-1">
                    <span className={`shrink-0 p-2.5 sm:p-3 rounded-full transition-colors ${room.isAi ? 'bg-purple-50 text-purple-500 group-hover:bg-purple-500 group-hover:text-white' : 'bg-blue-50 text-blue-500 group-hover:bg-blue-500 group-hover:text-white'}`}>
                      {room.isAi ? <Bot size={20} /> : <MessageSquare size={20} />}
                    </span>
                    <ScrollingTitle text={room.topic} className="font-bold text-base sm:text-lg text-gray-800" containerClass="flex-1" />
                  </div>
                  
                  <div className="mt-4 ml-12 sm:ml-14 bg-gray-50/80 rounded-2xl p-3 space-y-1.5 border border-gray-100 relative z-10">
                    {roomRecentMsgs.length > 0 ? (
                      roomRecentMsgs.map(msg => (
                        <div key={msg.id} className="text-[11px] flex gap-2 items-start w-full min-w-0">
                          <span className="font-bold text-gray-500 shrink-0">{msg.user}:</span>
                          <span className="text-gray-600 truncate flex-1">
                            {msg.imageUrl && !msg.content ? '📸 画像を送信しました' : msg.content}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-[11px] text-gray-400 italic">まだメッセージがありません✨</div>
                    )}
                  </div>
                  
                  <div className="ml-12 sm:ml-14 mt-3 flex flex-col gap-0.5 relative z-10">
                    <p className="text-[10px] sm:text-xs text-gray-400 font-bold">Created by {room.createdBy}</p>
                    <p className="text-[9px] sm:text-[10px] text-gray-500 font-medium flex items-center gap-1">
                      {room.createdAt?.toDate ? room.createdAt.toDate().toLocaleString('ja-JP', { 
                        year: 'numeric', month: 'short', day: 'numeric', 
                        hour: '2-digit', minute: '2-digit' 
                      }) : '作成中...'}
                    </p>
                  </div>
                  
                  {room.creatorId === user.uid && !room.isAi && (
                    <button 
                      onClick={async (e) => { e.stopPropagation(); if(window.confirm("本当に消しちゃう？")) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'rooms', room.id)); }} 
                      className="absolute bottom-4 sm:bottom-6 right-4 sm:right-6 text-gray-300 hover:text-red-400 bg-white p-2 rounded-full hover:bg-red-50 transition-all shadow-sm z-20"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </main>
      </div>
    );
  }

  // 👇 ルーム内画面
  return (
    <div className="flex flex-col h-screen w-full overflow-x-hidden bg-[#F0F4F8] font-sans relative" onClick={() => setActiveReactionMsgId(null)}>
      
      {/* 👇 スクロールアニメーション用のスタイルをここにも追加 */}
      <style>{`
        @keyframes scroll-text {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-100%); }
        }
        .animate-scroll-text {
          animation: scroll-text 15s linear infinite;
        }
      `}</style>

      {zoomedImage && (
        <div 
          className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in"
          onClick={() => setZoomedImage(null)}
        >
          <button className="absolute top-6 right-6 text-white hover:text-gray-300 bg-black/40 p-2 rounded-full transition-colors">
            <X size={24} />
          </button>
          <img 
            src={zoomedImage} 
            alt="zoomed" 
            className="max-w-full max-h-[90vh] rounded-lg object-contain shadow-2xl" 
          />
        </div>
      )}

      <header className="bg-white/80 backdrop-blur-md p-3 sm:p-4 px-3 sm:px-6 flex items-center shadow-sm sticky top-0 z-30 border-b border-white w-full">
        <div className="flex items-center gap-2 sm:gap-4 w-full min-w-0">
          <button onClick={() => leaveRoom()} className="shrink-0 hover:bg-blue-50 text-blue-500 p-2 sm:p-3 rounded-full transition-colors">
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1 min-w-0 flex flex-col justify-center pr-2">
            {/* 👇 ルーム内ヘッダーにも自動スクロールを適用 */}
            <ScrollingTitle text={currentRoom.topic} className="font-bold text-base sm:text-lg text-gray-800 leading-tight" containerClass="w-full" />
            <span className="text-[10px] text-blue-400 font-bold flex items-center gap-1 mt-0.5">
              <Users size={12} /> 会話中
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 space-y-0.5 max-w-3xl mx-auto w-full pb-24">
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-2xl text-sm font-bold mb-4 flex items-center justify-between shadow-sm mx-2 mt-2">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="p-1 hover:bg-red-100 rounded-full"><X size={16}/></button>
          </div>
        )}

        {currentMessages.map((msg, index) => {
          const isMe = msg.userId === user.uid;
          
          return (
            <div key={msg.id} className="flex gap-2 group items-start mb-2 w-full max-w-full">
              {msg.userPhoto ? (
                <img src={msg.userPhoto} className="w-8 h-8 rounded-full shadow-md border-2 border-white shrink-0 mt-3" alt="" />
              ) : (
                <div className={`w-8 h-8 mt-3 rounded-full flex items-center justify-center text-white shadow-md border-2 border-white font-bold text-xs shrink-0 ${isMe ? 'bg-indigo-300' : 'bg-blue-300'}`}>
                  {msg.user.slice(0,1)}
                </div>
              )}
              
              <div className="flex flex-col max-w-[85%] min-w-0 w-full">
                <span className="text-[10px] font-bold text-gray-400 mb-0.5 ml-1 flex items-baseline gap-2 mt-1">
                  <span className="truncate">{msg.user} {isMe && <span className="bg-blue-100 text-blue-600 px-1.5 rounded-md ml-1">自分</span>}</span>
                  <span className="text-[9px] font-normal text-gray-400 shrink-0">
                    {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </span>
                
                <div className={`
                  px-3 sm:px-4 py-2.5 sm:py-3 rounded-[1.5rem] shadow-sm text-sm font-medium leading-relaxed relative break-words flex flex-col w-fit max-w-full
                  ${isMe 
                    ? 'bg-white border-2 border-blue-100 text-gray-800 rounded-tl-none' 
                    : 'bg-white text-gray-700 rounded-tl-none border-2 border-transparent'}
                `}>
                  {msg.replyTo && (
                    <div className={`mb-2 text-[10px] p-2 rounded-xl line-clamp-2 ${isMe ? 'bg-blue-50/50 text-blue-600/80 border-l-2 border-blue-400' : 'bg-gray-50 text-gray-500 border-l-2 border-gray-300'}`}>
                      <span className="font-bold">{msg.replyTo.user}</span>: {msg.replyTo.hasImage ? '📸 画像' : msg.replyTo.content}
                    </div>
                  )}
                  
                  {msg.imageUrl && (
                    <img 
                      src={msg.imageUrl} 
                      alt="添付画像" 
                      onClick={() => setZoomedImage(msg.imageUrl)}
                      className={`max-w-full rounded-xl cursor-zoom-in hover:opacity-95 transition-opacity border border-black/5 ${msg.content ? 'mb-2' : 'mb-0'}`} 
                      style={{ maxHeight: '240px', objectFit: 'contain', backgroundColor: '#f9fafb' }}
                    />
                  )}

                  {msg.content && <div className="whitespace-pre-wrap word-break break-all">{msg.content}</div>}
                </div>
                
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div className="flex gap-1.5 mt-1.5 ml-1 flex-wrap max-w-full">
                    {Object.entries(msg.reactions).map(([emoji, uids]) => {
                      if (uids.length === 0) return null;
                      const hasReacted = uids.includes(user.uid);
                      return (
                        <button 
                          key={emoji}
                          onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, emoji); }}
                          className={`text-xs px-2 py-0.5 rounded-full border ${hasReacted ? 'bg-blue-50 border-blue-300 text-blue-600' : 'bg-white border-gray-200 text-gray-500'} shadow-sm flex items-center gap-1 transition-all hover:bg-gray-50 hover:scale-105 active:scale-95`}
                        >
                          <span>{emoji}</span>
                          <span className="font-bold text-[10px]">{uids.length}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
                
                <div className="flex gap-2 sm:gap-3 mt-1.5 ml-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all self-start relative z-10 flex-wrap">
                  <button onClick={(e) => { e.stopPropagation(); setReplyingTo(msg); }} className="text-[10px] text-gray-400 hover:text-blue-500 flex items-center gap-1 bg-white px-2 py-1 rounded-md shadow-sm border border-gray-100">
                    <Reply size={10}/> 返信
                  </button>
                  
                  <div className="relative">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveReactionMsgId(activeReactionMsgId === msg.id ? null : msg.id);
                      }}
                      className={`text-[10px] flex items-center gap-1 px-2 py-1 rounded-md shadow-sm border transition-colors ${activeReactionMsgId === msg.id ? 'bg-yellow-50 text-yellow-600 border-yellow-200' : 'bg-white text-gray-400 border-gray-100 hover:text-yellow-500'}`}
                    >
                      <Smile size={10}/> 反応
                    </button>
                    
                    {activeReactionMsgId === msg.id && (
                      <div className="absolute bottom-full left-0 sm:left-auto mb-2 flex bg-white shadow-xl rounded-full px-3 py-2 gap-3 border border-gray-100 z-50 animate-in fade-in slide-in-from-bottom-2">
                        {REACTION_EMOJIS.map(emoji => (
                          <button 
                            key={emoji} 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleReaction(msg.id, emoji);
                              setActiveReactionMsgId(null);
                            }} 
                            className="hover:scale-125 hover:-translate-y-1 transition-all text-xl"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {isMe && (
                    <button onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id); }} className="text-[10px] text-gray-300 hover:text-red-400 flex items-center gap-1 bg-white px-2 py-1 rounded-md shadow-sm border border-gray-100">
                      <Trash2 size={10}/> 削除
                    </button>
                  )}
                </div>

              </div>
            </div>
          );
        })}
        
        {currentMessages.length === 0 && (
          <div className="text-center py-20">
            <div className="bg-white p-6 rounded-full mb-4 inline-block shadow-sm">
              <Sparkles size={32} className="text-yellow-400" />
            </div>
            <p className="text-gray-400 font-bold text-sm">一番乗りで話しかけてみよう！✨</p>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <div className="bg-white border-t border-blue-50 flex flex-col fixed bottom-0 left-0 right-0 z-40 shadow-[0_-5px_20px_rgba(0,0,0,0.02)] sm:relative w-full">
        
        {replyingTo && (
          <div className="px-4 py-2 bg-blue-50/80 flex items-center justify-between text-xs border-b border-blue-100 backdrop-blur-sm w-full min-w-0">
            <div className="flex items-center gap-2 text-blue-700 overflow-hidden min-w-0">
              <Reply size={12} className="shrink-0" />
              <span className="font-bold shrink-0">{replyingTo.user} に返信 :</span>
              <span className="truncate opacity-80 flex-1">{replyingTo.hasImage ? '📸 画像' : replyingTo.content}</span>
            </div>
            <button onClick={() => setReplyingTo(null)} className="shrink-0 p-1 hover:bg-blue-200 rounded-full text-blue-500 transition-colors ml-2">
              <X size={14} />
            </button>
          </div>
        )}

        {selectedImage && (
          <div className="px-4 py-3 bg-gray-50 flex items-start justify-between border-b border-gray-100 w-full">
            <div className="relative inline-block">
              <img src={selectedImage} alt="preview" className="h-16 w-auto rounded-lg border border-gray-200 shadow-sm object-contain bg-white" />
              <button 
                onClick={() => setSelectedImage(null)}
                className="absolute -top-2 -right-2 bg-white rounded-full text-red-500 hover:text-red-600 shadow-md transition-transform hover:scale-110"
              >
                <XCircle size={20} className="fill-white" />
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="p-2 sm:p-3 flex gap-2 items-center max-w-3xl mx-auto w-full">
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageChange} 
            accept="image/*" 
            className="hidden" 
          />
          <button 
            type="button" 
            onClick={() => fileInputRef.current?.click()} 
            disabled={isCompressing}
            className={`p-2 rounded-full transition-colors flex-shrink-0 ${isCompressing ? 'text-blue-300 cursor-wait' : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'}`}
          >
            {isCompressing ? <Loader2 size={24} className="animate-spin" /> : <ImagePlus size={24} />}
          </button>

          <input 
            value={inputText} 
            onChange={e => setInputText(e.target.value)}
            placeholder={replyingTo ? "返信を入力..." : selectedImage ? "画像にコメント..." : "メッセージを入力..."} 
            className="flex-1 min-w-0 bg-gray-50 rounded-[2rem] px-4 sm:px-5 py-2.5 sm:py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all border border-gray-100 font-medium"
            disabled={isCompressing}
          />
          <button 
            type="submit" 
            disabled={(!inputText.trim() && !selectedImage) || isCompressing} 
            className="bg-blue-500 text-white p-2.5 sm:p-3 flex-shrink-0 rounded-full hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:scale-100 disabled:shadow-none transition-all active:scale-95"
          >
            <Send size={18} className="ml-0.5 sm:hidden" />
            <Send size={20} className="ml-0.5 hidden sm:block" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default App;
