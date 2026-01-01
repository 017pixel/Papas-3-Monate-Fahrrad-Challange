/**
 * Fahrrad-Tracker PWA
 * No Frameworks, Just Logic.
 */

// --- CONFIG & DATA ---
const CONFIG = {
    standardTime: 15, // Minutes
    quests: [5, 10, 15],
    quotes: [
        "Der Weg ist das Ziel.",
        "Jeder Tritt macht dich stärker.",
        "Disziplin ist Freiheit.",
        "Heute ist ein guter Tag zum Fahren.",
        "Kleine Schritte, große Ergebnisse.",
        "Du tust das für dich.",
        "Bleib dran!",
        "Stark angefangen, stark weitergemacht.",
        "Deine Gesundheit dankt dir.",
        "Fahrradfahren ist Freiheit.",
        "Einfach losfahren.",
        "15 Minuten sind 1% deines Tages.",
        "Sei stolz auf dich.",
        "Konsequenz schlägt Intensität.",
        "Bewegung ist Leben.",
        "Genieß den Fahrtwind.",
        "Mach es zu deiner Routine.",
        "Du wirst jeden Tag besser.",
        "Dein zukünftiges Ich wird dir danken.",
        "Aufgeben ist keine Option."
    ]
};

// --- STATE MANAGEMENT ---
const State = {
    data: {
        streak: 0,
        lastCompletedDate: null,
        totalQuests: 0,
        today: {
            date: null,
            questMinutes: 0,
            questAccepted: false,
            mainTaskDone: false,
            timerTarget: null // timestamp
        }
    },

    load() {
        const stored = localStorage.getItem('fahrrad_tracker_data');
        if (stored) {
            this.data = JSON.parse(stored);
        }
        this.checkDayReset();
    },

    save() {
        localStorage.setItem('fahrrad_tracker_data', JSON.stringify(this.data));
    },

    checkDayReset() {
        const todayStr = new Date().toDateString();
        if (this.data.today.date !== todayStr) {
            // New Day
            this.data.today = {
                date: todayStr,
                questMinutes: this.getRandomQuest(),
                questAccepted: false,
                mainTaskDone: false,
                timerTarget: null
            };

            // Generate Daily Quote logic can be stateless based on date hash if we wanted, 
            // but we can just render random on load or save it. 
            // The constraint: "stays same for whole day". 
            // We'll store the quote index for today if we wanted, or just pick deterministically.
            // Let's implement deterministic daily quote to avoid storing string.

            this.save();
        }
    },

    getRandomQuest() {
        return CONFIG.quests[Math.floor(Math.random() * CONFIG.quests.length)];
    }
};

// --- VIEW CONTROLLER ---
const UI = {
    elems: {
        timerDisplay: document.getElementById('timer-display'),
        btnStart: document.getElementById('btn-start'),
        btnCancel: document.getElementById('btn-cancel'),
        groupQuest: document.getElementById('quest-container'),
        questText: document.getElementById('quest-text'),
        btnAcceptQuest: document.getElementById('btn-accept-quest'),
        questMinutesSpan: document.getElementById('quest-minutes'),
        questStatus: document.getElementById('quest-status'),
        streakValue: document.getElementById('streak-value'),
        totalQuestsValue: document.getElementById('total-quests-value'),
        quoteText: document.getElementById('daily-quote'),
        navBtns: document.querySelectorAll('.nav-btn'),
        views: document.querySelectorAll('.view')
    },

    timerInterval: null,

    init() {
        // Navigation
        this.elems.navBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const target = btn.dataset.target;
                this.switchView(target);
            });
        });

        // Event Listeners
        this.elems.btnStart.addEventListener('click', () => Timer.start());
        this.elems.btnCancel.addEventListener('click', () => Timer.cancel());
        this.elems.btnAcceptQuest.addEventListener('click', () => Logic.acceptQuest());

        // Initial Render
        this.render();

        // Resume Timer if active
        if (State.data.today.timerTarget) {
            Timer.resume();
        }

        // Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js')
                .then(() => console.log('SW Registered'));
        }
    },

    switchView(viewId) {
        this.elems.views.forEach(v => v.classList.remove('active'));
        this.elems.navBtns.forEach(b => b.classList.remove('active'));

        document.getElementById(viewId).classList.add('active');
        document.querySelector(`[data-target="${viewId}"]`).classList.add('active');
    },

    render() {
        // Streak & Stats
        this.elems.streakValue.textContent = State.data.streak;
        this.elems.totalQuestsValue.textContent = State.data.totalQuests;

        // Quote (Deterministic based on date)
        const dayIndex = new Date().getDate() % CONFIG.quotes.length;
        this.elems.quoteText.textContent = CONFIG.quotes[dayIndex];

        // Quest UI
        const today = State.data.today;
        if (today.mainTaskDone) {
            this.elems.timerDisplay.textContent = "Fertig! 🎉";
            this.elems.timerDisplay.style.color = "var(--success)";
            this.elems.btnStart.classList.add('hidden');
            this.elems.btnCancel.classList.add('hidden');
            this.elems.groupQuest.classList.add('hidden');
        } else {
            this.elems.timerDisplay.textContent = this.formatTime(this.getTaskDuration() * 60);
            this.elems.timerDisplay.style.color = "var(--primary)";
            this.elems.groupQuest.classList.remove('hidden');

            this.elems.questText.textContent = `Fahre ${today.questMinutes} Minuten extra!`;
            this.elems.questMinutesSpan.textContent = today.questMinutes;

            if (today.questAccepted) {
                this.elems.btnAcceptQuest.classList.add('hidden');
                this.elems.questStatus.classList.remove('hidden');
            } else {
                this.elems.btnAcceptQuest.classList.remove('hidden');
                this.elems.questStatus.classList.add('hidden');
            }
        }
    },

    getTaskDuration() {
        // Base 15 + Extra if accepted
        let duration = CONFIG.standardTime;
        if (State.data.today.questAccepted) {
            duration += State.data.today.questMinutes;
        }
        return duration;
    },

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    },

    updateTimerDisplay(secondsLeft) {
        this.elems.timerDisplay.textContent = this.formatTime(secondsLeft);
    }
};

// --- CORE LOGIC ---
const Logic = {
    acceptQuest() {
        State.data.today.questAccepted = true;
        State.save();
        UI.render();
    },

    completeTask() {
        State.data.today.mainTaskDone = true;
        State.data.today.timerTarget = null;

        // Streak Logic
        const now = new Date();
        const lastCompleted = State.data.lastCompletedDate ? new Date(State.data.lastCompletedDate) : null;

        // Check if streak is contiguous
        if (lastCompleted) {
            const diffTime = Math.abs(now - lastCompleted);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            // Note: Simplistic dayDiff. A better way is resetting streak on load if missed.
            // But let's just increment safely here.
            // If already done today, don't increment (handled by mainTaskDone check)
        }

        // Actually, robustness:
        // When checking day reset in State.load(), we should check if yesterday was missed.
        // Here we just increment because we finished a task successfully today.

        // Increment streak if not already done today (obviously)
        State.data.streak++;
        State.data.lastCompletedDate = now.toDateString();

        if (State.data.today.questAccepted) {
            State.data.totalQuests++;
        }

        State.save();
        UI.render();
        alert("Stark! Deine heutige Runde ist erledigt 🚴‍♂️");
    }
};

// --- TIMER ENGINE ---
const Timer = {
    intervalId: null,

    start() {
        const durationMin = UI.getTaskDuration();
        const durationMs = durationMin * 60 * 1000;
        const now = Date.now();
        const target = now + durationMs;

        State.data.today.timerTarget = target;
        State.save();

        UI.elems.btnStart.classList.add('hidden');
        UI.elems.btnCancel.classList.remove('hidden');
        UI.elems.groupQuest.classList.add('hidden'); // Cannot change quest while running

        this.tick();
        this.intervalId = setInterval(() => this.tick(), 1000);
    },

    resume() {
        UI.elems.btnStart.classList.add('hidden');
        UI.elems.btnCancel.classList.remove('hidden');
        UI.elems.groupQuest.classList.add('hidden');
        this.tick();
        this.intervalId = setInterval(() => this.tick(), 1000);
    },

    tick() {
        const target = State.data.today.timerTarget;
        if (!target) return;

        const now = Date.now();
        const remainingMs = target - now;

        if (remainingMs <= 0) {
            this.finish();
        } else {
            UI.updateTimerDisplay(remainingMs / 1000);
        }
    },

    cancel() {
        if (confirm("Möchtest du wirklich abbrechen? Der Fortschritt geht verloren.")) {
            clearInterval(this.intervalId);
            State.data.today.timerTarget = null;
            State.save();

            UI.elems.btnStart.classList.remove('hidden');
            UI.elems.btnCancel.classList.add('hidden');
            UI.elems.groupQuest.classList.remove('hidden');
            UI.render(); // Resets time display
        }
    },

    finish() {
        clearInterval(this.intervalId);
        Logic.completeTask();
    }
};

// --- BOOTSTRAP ---
// Check Streak validity on load
State.load();
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayStr = yesterday.toDateString();
const todayStr = new Date().toDateString();

// If last completed was before yesterday, and it's not today (new day started), reset streak.
if (State.data.lastCompletedDate) {
    if (State.data.lastCompletedDate !== yesterdayStr && State.data.lastCompletedDate !== todayStr) {
        State.data.streak = 0;
        State.save();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    UI.init();
});
