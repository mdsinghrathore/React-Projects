import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_QUESTIONS } from './questionsData';

// Role-Based User Credentials
const USERS_DB = [
  { email: 'admin@example.com', password: 'admin123', role: 'admin' },
  { email: 'student@example.com', password: 'student123', role: 'student' }
];

const QuizApp = () => {
  // Authentication & Role State
  const [user, setUser] = useState(null); // { email, role }
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');

  console.log("hello")
  // Master Question Pool (Initial + Approved Custom Questions)
  const [allQuestions, setAllQuestions] = useState(() => {
    const saved = localStorage.getItem('custom_questions');
    if (saved) {
      try { return [...INITIAL_QUESTIONS, ...JSON.parse(saved)]; } catch (e) { return INITIAL_QUESTIONS; }
    }
    return INITIAL_QUESTIONS;
  });

  // Pending Suggestions Pool (Submitted by Students)
  const [pendingSuggestions, setPendingSuggestions] = useState(() => {
    const saved = localStorage.getItem('pending_suggestions');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return []; }
    }
    return [];
  });

  // App & Test States
  const [testTimeMinutes, setTestTimeMinutes] = useState(5);
  const [testStatus, setTestStatus] = useState('idle'); // 'idle' | 'running' | 'completed'
  const [activeQuestions, setActiveQuestions] = useState([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [questionTimeLeft, setQuestionTimeLeft] = useState(60);

  // Form Toggles & State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [newQ, setNewQ] = useState({
    question: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    explanation: ''
  });

  const timerRef = useRef(null);

  // Helper: Fisher-Yates Shuffle
  const shuffleArray = (array) => {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // Login Handler
  const handleLogin = (e) => {
    e.preventDefault();
    const foundUser = USERS_DB.find(
      (u) => u.email.toLowerCase() === loginEmail.trim().toLowerCase() && u.password === loginPassword
    );

    if (foundUser) {
      setUser({ email: foundUser.email, role: foundUser.role });
      setAuthError('');
    } else {
      setAuthError('Invalid email or password!');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setTestStatus('idle');
    setLoginPassword('');
    setShowAddModal(false);
    setShowPendingModal(false);
  };

  // Start Test Setup
  const handleStartTest = () => {
    const numQuestionsNeeded = Math.min(testTimeMinutes, allQuestions.length);
    const shuffledPool = shuffleArray(allQuestions);
    const selected = shuffledPool.slice(0, numQuestionsNeeded);

    setActiveQuestions(selected);
    setUserAnswers({});
    setCurrentQuestionIdx(0);
    setQuestionTimeLeft(60);
    setTestStatus('running');
  };

  // Per-Question Countdown Timer Effect
  useEffect(() => {
    if (testStatus === 'running') {
      timerRef.current = setInterval(() => {
        setQuestionTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleAutoNext();
            return 60;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [testStatus, currentQuestionIdx]);

  const handleAutoNext = () => {
    if (currentQuestionIdx < activeQuestions.length - 1) {
      setCurrentQuestionIdx((prev) => prev + 1);
      setQuestionTimeLeft(60);
    } else {
      handleCompleteTest();
    }
  };

  const handleManualNext = () => {
    clearInterval(timerRef.current);
    if (currentQuestionIdx < activeQuestions.length - 1) {
      setCurrentQuestionIdx((prev) => prev + 1);
      setQuestionTimeLeft(60);
    } else {
      handleCompleteTest();
    }
  };

  const handleCompleteTest = () => {
    clearInterval(timerRef.current);
    setTestStatus('completed');
  };

  const handleSelectAnswer = (optionIdx) => {
    setUserAnswers((prev) => ({
      ...prev,
      [currentQuestionIdx]: optionIdx
    }));
  };

  // Question Submission (Admin creates directly / Student creates suggestion)
  const handleCreateOrSuggestQuestion = (e) => {
    e.preventDefault();
    if (!newQ.question || newQ.options.some((o) => !o.trim())) {
      alert("Please fill in the question and all 4 options!");
      return;
    }

    const questionObj = { ...newQ, id: Date.now(), suggestedBy: user.email };

    if (user.role === 'admin') {
      // Direct insertion for Admin
      const updatedPool = [...allQuestions, questionObj];
      setAllQuestions(updatedPool);
      const customOnly = updatedPool.filter((q) => !INITIAL_QUESTIONS.some((iq) => iq.id === q.id));
      localStorage.setItem('custom_questions', JSON.stringify(customOnly));
      alert("Question directly added to active pool!");
    } else {
      // Pending queue insertion for Student
      const updatedPending = [...pendingSuggestions, questionObj];
      setPendingSuggestions(updatedPending);
      localStorage.setItem('pending_suggestions', JSON.stringify(updatedPending));
      alert("Your question suggestion has been sent to the admin for review!");
    }

    setNewQ({ question: '', options: ['', '', '', ''], correctAnswer: 0, explanation: '' });
    setShowAddModal(false);
  };

  // Admin Approval
  const handleApproveSuggestion = (suggestionId) => {
    const itemToApprove = pendingSuggestions.find((item) => item.id === suggestionId);
    if (!itemToApprove) return;

    // Add to active pool
    const updatedPool = [...allQuestions, itemToApprove];
    setAllQuestions(updatedPool);
    const customOnly = updatedPool.filter((q) => !INITIAL_QUESTIONS.some((iq) => iq.id === q.id));
    localStorage.setItem('custom_questions', JSON.stringify(customOnly));

    // Remove from pending
    const remainingPending = pendingSuggestions.filter((item) => item.id !== suggestionId);
    setPendingSuggestions(remainingPending);
    localStorage.setItem('pending_suggestions', JSON.stringify(remainingPending));

    alert("Suggestion approved and added to active test questions!");
  };

  // Admin Rejection
  const handleRejectSuggestion = (suggestionId) => {
    const remainingPending = pendingSuggestions.filter((item) => item.id !== suggestionId);
    setPendingSuggestions(remainingPending);
    localStorage.setItem('pending_suggestions', JSON.stringify(remainingPending));
  };

  const calculateScore = () => {
    let score = 0;
    activeQuestions.forEach((q, idx) => {
      if (userAnswers[idx] === q.correctAnswer) score += 1;
    });
    return score;
  };

  // 1. LOGIN SCREEN
  if (!user) {
    return (
      <div style={styles.appContainer}>
        <div style={styles.ambientGlow} />
        <div style={styles.card}>
          <div style={styles.logoBadge}>✨ QuizPortal</div>
          <h1 style={styles.title}>Welcome Back</h1>
          <p style={styles.subtitle}>Sign in to access your assessment portal</p>

          <form onSubmit={handleLogin} style={styles.formStack}>
            {authError && <div style={styles.errorAlert}>{authError}</div>}

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Email Address</label>
              <input
                type="email"
                placeholder="e.g. student@example.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                style={styles.textInput}
                required
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.fieldLabel}>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={styles.textInput}
                required
              />
            </div>

            <button type="submit" style={styles.primaryGlowBtn}>
              Sign In
            </button>
          </form>

          {/* Demo Credentials Box - Admin details removed */}
          <div style={styles.demoCredentialsBox}>
            <span style={{ fontSize: '0.8rem', color: '#0f766e', fontWeight: '700' }}>Demo Student Credentials:</span>
            <div style={{ fontSize: '0.85rem', color: '#1e293b', marginTop: '4px' }}>
              <strong>Email:</strong> student@example.com <br />
              <strong>Password:</strong> student123
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. SETUP SCREEN (IDLE DASHBOARD)
  if (testStatus === 'idle') {
    return (
      <div style={styles.appContainer}>
        <div style={styles.ambientGlow} />
        <div style={styles.card}>
          <div style={styles.topNav}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={styles.userBadge}>👤 {user.email}</span>
              <span style={styles.roleTag}>Role: {user.role.toUpperCase()}</span>
            </div>
            <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
          </div>

          <h1 style={styles.title}>Mock Test Quiz</h1>
          <p style={styles.subtitle}>1 Minute Allocated Per Question</p>

          <div style={styles.setupGroup}>
            <label style={styles.fieldLabel}>
              Select Test Duration (Minutes):
              <input
                type="number"
                min="1"
                max={allQuestions.length}
                value={testTimeMinutes}
                onChange={(e) => setTestTimeMinutes(Math.max(1, Math.min(allQuestions.length, parseInt(e.target.value) || 1)))}
                style={{ ...styles.textInput, textAlign: 'center', fontSize: '1.2rem', marginTop: '8px' }}
              />
            </label>
          </div>

          <div style={styles.infoBox}>
            <div style={styles.infoRow}><span>Selected Questions:</span> <strong>{testTimeMinutes}</strong></div>
            <div style={styles.infoRow}><span>Timer Per Question:</span> <strong>60 Seconds</strong></div>
            <div style={styles.infoRow}><span>Active Questions Pool:</span> <strong>{allQuestions.length} Questions</strong></div>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
            <button onClick={handleStartTest} style={styles.primaryGlowBtn}>
              🚀 Start Mock Test
            </button>

            {/* Admin Management & Student Suggestion Buttons */}
            {user.role === 'admin' ? (
              <>
                <button onClick={() => { setShowAddModal(!showAddModal); setShowPendingModal(false); }} style={styles.secondaryBtn}>
                  {showAddModal ? 'Close Form' : '🛠️ Add Official Question (Admin)'}
                </button>

                <button onClick={() => { setShowPendingModal(!showPendingModal); setShowAddModal(false); }} style={{ ...styles.secondaryBtn, borderColor: pendingSuggestions.length > 0 ? '#0891b2' : '#cbd5e1' }}>
                  📥 Review Student Suggestions ({pendingSuggestions.length})
                </button>
              </>
            ) : (
              <button onClick={() => setShowAddModal(!showAddModal)} style={styles.secondaryBtn}>
                {showAddModal ? 'Close Form' : '💡 Suggest a Question'}
              </button>
            )}
          </div>

          {/* Form for Question Addition / Suggestion */}
          {showAddModal && (
            <form onSubmit={handleCreateOrSuggestQuestion} style={styles.addForm}>
              <h3 style={{ marginTop: 0, color: '#0f172a' }}>
                {user.role === 'admin' ? 'Add New Question directly' : 'Suggest a Question'}
              </h3>
              <input
                type="text"
                placeholder="Question statement..."
                value={newQ.question}
                onChange={(e) => setNewQ({ ...newQ, question: e.target.value })}
                style={styles.textInput}
                required
              />

              {newQ.options.map((opt, i) => (
                <input
                  key={i}
                  type="text"
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  value={opt}
                  onChange={(e) => {
                    const opts = [...newQ.options];
                    opts[i] = e.target.value;
                    setNewQ({ ...newQ, options: opts });
                  }}
                  style={styles.textInput}
                  required
                />
              ))}

              <label style={{ fontSize: '0.85rem', color: '#475569', display: 'block', margin: '8px 0' }}>
                Correct Option:
                <select
                  value={newQ.correctAnswer}
                  onChange={(e) => setNewQ({ ...newQ, correctAnswer: parseInt(e.target.value) })}
                  style={styles.selectInput}
                >
                  <option value={0}>Option A</option>
                  <option value={1}>Option B</option>
                  <option value={2}>Option C</option>
                  <option value={3}>Option D</option>
                </select>
              </label>

              <textarea
                placeholder="Explanation..."
                value={newQ.explanation}
                onChange={(e) => setNewQ({ ...newQ, explanation: e.target.value })}
                style={{ ...styles.textInput, height: '50px' }}
              />

              <button type="submit" style={{ ...styles.primaryGlowBtn, backgroundColor: '#0d9488', marginTop: '10px' }}>
                {user.role === 'admin' ? 'Save Directly' : 'Submit for Admin Approval'}
              </button>
            </form>
          )}

          {/* Admin Pending Suggestions Queue */}
          {showPendingModal && user.role === 'admin' && (
            <div style={styles.addForm}>
              <h3 style={{ marginTop: 0, color: '#0f172a' }}>Pending Student Suggestions</h3>
              {pendingSuggestions.length === 0 ? (
                <p style={{ color: '#64748b', fontSize: '0.9rem' }}>No pending suggestions right now.</p>
              ) : (
                pendingSuggestions.map((item) => (
                  <div key={item.id} style={styles.suggestionItem}>
                    <div style={{ fontSize: '0.8rem', color: '#0e7490', fontWeight: 'bold' }}>
                      From: {item.suggestedBy}
                    </div>
                    <div style={{ fontWeight: '600', margin: '4px 0' }}>{item.question}</div>
                    <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                      Correct Option: {String.fromCharCode(65 + item.correctAnswer)} ({item.options[item.correctAnswer]})
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button onClick={() => handleApproveSuggestion(item.id)} style={styles.approveBtn}>Approve</button>
                      <button onClick={() => handleRejectSuggestion(item.id)} style={styles.rejectBtn}>Reject</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. RESULTS SCREEN
  if (testStatus === 'completed') {
    const score = calculateScore();
    const percentage = Math.round((score / activeQuestions.length) * 100);

    return (
      <div style={styles.appContainer}>
        <div style={styles.ambientGlow} />
        <div style={{ ...styles.card, maxWidth: '680px' }}>
          <h1 style={styles.title}>Test Summary</h1>

          <div style={styles.scoreBoard}>
            <div style={styles.scoreText}>
              {score} <span style={{ fontSize: '1.5rem', color: '#64748b' }}>/ {activeQuestions.length}</span>
            </div>
            <div style={styles.percentageText}>{percentage}% Accuracy</div>
          </div>

          <h3 style={styles.reviewHeader}>Detailed Assessment Review</h3>
          <div style={styles.reviewList}>
            {activeQuestions.map((q, idx) => {
              const isCorrect = userAnswers[idx] === q.correctAnswer;
              const isUnanswered = userAnswers[idx] === undefined;

              return (
                <div
                  key={q.id || idx}
                  style={{
                    ...styles.reviewCard,
                    borderLeftColor: isCorrect ? '#0d9488' : isUnanswered ? '#d97706' : '#e11d48'
                  }}
                >
                  <div style={styles.questionText}>
                    <strong>Q{idx + 1}:</strong> {q.question}
                  </div>

                  <div style={styles.reviewDetail}>
                    <div>
                      <strong>Your Selection:</strong> {' '}
                      <span style={{ color: isCorrect ? '#0d9488' : isUnanswered ? '#d97706' : '#e11d48', fontWeight: '600' }}>
                        {isUnanswered ? 'Time Expired / No Selection' : q.options[userAnswers[idx]]}
                      </span>
                    </div>
                    {!isCorrect && (
                      <div>
                        <strong>Correct Answer:</strong> {' '}
                        <span style={{ color: '#0d9488', fontWeight: '600' }}>{q.options[q.correctAnswer]}</span>
                      </div>
                    )}
                  </div>

                  {q.explanation && (
                    <p style={styles.explanation}>
                      <em>Explanation:</em> {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <button onClick={() => setTestStatus('idle')} style={styles.primaryGlowBtn}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // 4. ACTIVE TEST DISPLAY
  const currentQ = activeQuestions[currentQuestionIdx];

  return (
    <div style={styles.appContainer}>
      <div style={styles.ambientGlow} />
      <div style={{ ...styles.card, maxWidth: '750px' }}>
        {/* Header Bar */}
        <div style={styles.header}>
          <span style={styles.qCounter}>
            Question {currentQuestionIdx + 1} of {activeQuestions.length}
          </span>

          <div style={{
            ...styles.timerBadge,
            borderColor: questionTimeLeft <= 15 ? '#e11d48' : '#0891b2',
            color: questionTimeLeft <= 15 ? '#e11d48' : '#0e7490',
            backgroundColor: questionTimeLeft <= 15 ? '#ffe4e6' : '#ecfeff',
            boxShadow: questionTimeLeft <= 15 ? '0 0 12px rgba(225, 29, 72, 0.2)' : '0 0 12px rgba(8, 145, 178, 0.2)'
          }}>
            ⏱️ {questionTimeLeft}s
          </div>
        </div>

        {/* Question Area */}
        <div style={styles.questionSection}>
          <h2 style={styles.questionHeader}>{currentQ?.question}</h2>
          <div style={styles.optionsList}>
            {currentQ?.options.map((opt, optIdx) => {
              const isSelected = userAnswers[currentQuestionIdx] === optIdx;
              return (
                <button
                  key={optIdx}
                  onClick={() => handleSelectAnswer(optIdx)}
                  style={{
                    ...styles.optionBtn,
                    backgroundColor: isSelected ? '#cff4fc' : 'rgba(255, 255, 255, 0.8)',
                    borderColor: isSelected ? '#0891b2' : '#cbd5e1',
                    color: isSelected ? '#0e7490' : '#334155',
                    fontWeight: isSelected ? '600' : 'normal'
                  }}
                >
                  <span style={{
                    ...styles.optionIndex,
                    color: isSelected ? '#0891b2' : '#64748b'
                  }}>
                    {String.fromCharCode(65 + optIdx)}
                  </span>
                  {opt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button
            onClick={handleManualNext}
            style={{
              ...styles.primaryGlowBtn,
              backgroundColor: currentQuestionIdx === activeQuestions.length - 1 ? '#0d9488' : '#0891b2'
            }}
          >
            {currentQuestionIdx === activeQuestions.length - 1 ? 'Submit Test' : 'Next Question →'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Styling Object
const styles = {
  appContainer: {
    minHeight: '100vh',
    width: '100%',
    backgroundColor: '#ecfeff',
    backgroundImage: 'radial-gradient(at 0% 0%, #cff4fc 0px, transparent 50%), radial-gradient(at 100% 100%, #e0f2fe 0px, transparent 50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
  },
  ambientGlow: {
    position: 'absolute',
    width: '650px',
    height: '650px',
    background: 'radial-gradient(circle, rgba(165, 243, 252, 0.6) 0%, rgba(186, 230, 253, 0.3) 45%, rgba(255, 255, 255, 0) 70%)',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: 0
  },
  card: {
    width: '100%',
    maxWidth: '480px',
    padding: '32px',
    borderRadius: '20px',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(16px)',
    border: '1px solid rgba(165, 243, 252, 0.8)',
    boxShadow: '0 20px 40px -15px rgba(8, 145, 178, 0.12)',
    color: '#0f172a',
    zIndex: 1,
    boxSizing: 'border-box'
  },
  logoBadge: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: '#0891b2',
    textAlign: 'center',
    marginBottom: '8px',
    letterSpacing: '1px',
    textTransform: 'uppercase'
  },
  title: { margin: '0 0 8px 0', fontSize: '1.8rem', fontWeight: '700', textAlign: 'center', color: '#0e7490' },
  subtitle: { textAlign: 'center', color: '#475569', fontSize: '0.95rem', marginBottom: '24px' },
  topNav: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' },
  userBadge: { fontSize: '0.85rem', color: '#0f766e', fontWeight: '600' },
  roleTag: { fontSize: '0.7rem', color: '#0284c7', fontWeight: 'bold' },
  logoutBtn: { backgroundColor: 'transparent', border: 'none', color: '#e11d48', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' },
  formStack: { display: 'flex', flexDirection: 'column', gap: '16px' },
  fieldGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  fieldLabel: { fontSize: '0.85rem', color: '#334155', fontWeight: '600' },
  textInput: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#0f172a',
    fontSize: '0.9rem',
    outline: 'none',
    marginBottom: '6px',
    boxSizing: 'border-box'
  },
  primaryGlowBtn: {
    width: '100%',
    padding: '14px',
    fontSize: '1rem',
    fontWeight: '600',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#0891b2',
    color: '#ffffff',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(8, 145, 178, 0.3)'
  },
  secondaryBtn: {
    width: '100%',
    padding: '12px',
    fontSize: '0.9rem',
    fontWeight: '600',
    borderRadius: '8px',
    border: '1px solid #cbd5e1',
    backgroundColor: '#ffffff',
    color: '#334155',
    cursor: 'pointer'
  },
  errorAlert: {
    backgroundColor: '#ffe4e6',
    border: '1px solid #fecdd3',
    color: '#e11d48',
    padding: '10px 12px',
    borderRadius: '6px',
    fontSize: '0.85rem',
    textAlign: 'center'
  },
  demoCredentialsBox: {
    marginTop: '20px',
    padding: '12px',
    backgroundColor: '#ccfbf1',
    border: '1px dashed #5eead4',
    borderRadius: '8px',
    textAlign: 'center'
  },
  setupGroup: { marginBottom: '20px' },
  infoBox: {
    backgroundColor: '#f0fdf4',
    padding: '16px',
    borderRadius: '10px',
    marginBottom: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    border: '1px solid #bbf7d0'
  },
  infoRow: { display: 'flex', justifyContent: 'space-between', color: '#166534', fontSize: '0.9rem' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px', marginBottom: '20px' },
  qCounter: { fontWeight: '600', color: '#64748b' },
  timerBadge: { fontFamily: 'monospace', fontSize: '1.2rem', fontWeight: 'bold', padding: '4px 14px', borderRadius: '20px', border: '1px solid #0891b2' },
  questionSection: { marginBottom: '24px' },
  questionHeader: { fontSize: '1.25rem', fontWeight: '600', marginBottom: '20px', lineHeight: '1.5', color: '#0f172a' },
  optionsList: { display: 'flex', flexDirection: 'column', gap: '12px' },
  optionBtn: { display: 'flex', alignItems: 'center', textAlign: 'left', padding: '14px 18px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '0.95rem', cursor: 'pointer' },
  optionIndex: { fontWeight: 'bold', marginRight: '14px', fontSize: '1rem' },
  footer: { display: 'flex', justifyContent: 'flex-end' },
  scoreBoard: { textAlign: 'center', backgroundColor: '#e0f2fe', padding: '24px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #bae6fd' },
  scoreText: { fontSize: '3rem', fontWeight: 'bold', color: '#0284c7' },
  percentageText: { fontSize: '1rem', color: '#0369a1', marginTop: '4px', fontWeight: '600' },
  reviewHeader: { fontSize: '1.1rem', marginBottom: '16px', color: '#0f172a' },
  reviewList: { display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto', paddingRight: '8px', marginBottom: '24px' },
  reviewCard: { backgroundColor: '#ffffff', padding: '14px 16px', borderRadius: '8px', borderLeft: '4px solid #94a3b8', fontSize: '0.9rem' },
  questionText: { marginBottom: '8px', fontSize: '0.95rem', color: '#0f172a' },
  reviewDetail: { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' },
  explanation: { margin: '0', color: '#64748b', fontSize: '0.85rem' },
  addForm: { backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', marginTop: '16px', border: '1px solid #cbd5e1' },
  selectInput: { padding: '8px 12px', marginLeft: '8px', borderRadius: '6px', backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #cbd5e1' },
  suggestionItem: { backgroundColor: '#ffffff', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '8px', marginBottom: '10px' },
  approveBtn: { backgroundColor: '#0d9488', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' },
  rejectBtn: { backgroundColor: '#e11d48', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold' }
};

export default QuizApp;