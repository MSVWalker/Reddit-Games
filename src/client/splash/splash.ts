import { requestExpandedMode } from "@devvit/web/client";

const startButton = document.getElementById("start-button") as HTMLButtonElement;

// Fetch and display streak
fetch('/api/personal-best')
    .then(res => res.json())
    .then(data => {
        if (data.personalBest && data.personalBest.streak > 1) {
            const streakEl = document.createElement('div');
            streakEl.style.color = '#e74c3c';
            streakEl.style.fontWeight = 'bold';
            streakEl.style.marginTop = '15px';
            streakEl.style.fontSize = '1.2rem';
            streakEl.style.animation = 'pulse 2s infinite';
            streakEl.style.textShadow = '0 0 10px rgba(231, 76, 60, 0.5)';
            streakEl.innerHTML = `🔥 ${data.personalBest.streak} Day Streak!`;

            // Insert after start button container
            startButton.parentElement?.appendChild(streakEl);
        }
    })
    .catch(console.error);

startButton.addEventListener("click", (e) => {
    requestExpandedMode(e, "game");
});
