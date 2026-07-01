# Badminton Court Scorer & Live Visualizer

Single-page web application designed for badminton referees, players, and clubs to track rally-point matches, visualize player positioning, and monitor statistics in real-time.

It features a responsive visualizer of a badminton court, automatic doubles service tracking, match and rally timers, interval warnings with buzzer sounds, and live statistics charts.

---

## Key Features

- **Dynamic 2D Court Visualizer**: A beautiful SVG-rendered badminton court showing boundary lines, net posts, and player locations.
- **BWF Doubles Position Tracking**: Automatically tracks and positions players in their service courts based on server/receiver assignments and score parity (Even/Odd).
- **Match Setup Options**:
  - Toggles between Singles and Doubles.
  - Custom country, club, and jersey colors.
  - Configuration of match sets (Best of 1, 3, or 5) and target/cap points (default 21, capped at 30).
- **Interactive Service Indicators**: Renders glowing borders around active service/receiver boxes, with a moving dashed arrow showing the service path.
- **Rally & Match Timers**:
  - Match timer with pause/resume functions.
  - Rally timer that counts seconds between points and resets automatically upon scoring.
- **Automated Match Intervals**:
  - A 60-second технический (technical) interval warning when a team reaches 11 points.
  - A 120-second interval between sets.
  - Synthesized audio buzzers and countdown warning tones generated via the browser's Web Audio API.
- **Analytics & History**:
  - Live scrollable logs capturing every point and service rotation.
  - Real-time stats dashboard monitoring average rally durations and consecutive point streaks.
  - Score progress chart drawing a live SVG graph of the match timeline.
- **Undo / Redo Stack**: A robust referee history system to easily undo and correction-revert scoring mistakes.
- **Manual Adjustments**: Allows manual court positioning swaps for players in case they get out of alignment.
- **Persistence**: Save/resume capability using `localStorage`, keeping matches alive across page reloads.

---

## BWF Doubles Service Rules Followed

1. **Service Side**: Determined by the server's score. Even scores (0, 2, 4...) serve from the Right court; Odd scores (1, 3, 5...) serve from the Left court.
2. **Serving Side Wins Rally**: The serving side scores a point. The same server switches service courts (Right <-> Left) and serves again.
3. **Receiving Side Wins Rally**: The receiving side scores a point and becomes the new serving side. **No players change positions.** The server is determined by the team's score:
   - If the new score is Even, the player standing in the Right service court serves.
   - If the new score is Odd, the player standing in the Left service court serves.

---

## File Structure

- [index.html](file:///c:/src/badminton-score-keeper/index.html) - Structural framework containing inputs, panels, modal overlays, and the SVG court graphic.
- [styles.css](file:///c:/src/badminton-score-keeper/styles.css) - Styling sheet utilizing dark-mode custom properties, glassmorphic styling, neon highlighting, and responsive grids.
- [app.js](file:///c:/src/badminton-score-keeper/app.js) - Core game logic engine handling scoring transitions, timer ticks, sound wave synthesis, log formatting, and coordinate mapping.

---

## How to Run

### Option 1: Direct Open
Simply double-click the [index.html](file:///c:/src/badminton-score-keeper/index.html) file or open it in any modern web browser.

### Option 2: Local HTTP Server (Recommended)
To run on a local HTTP server for full capability, navigate to the folder in your terminal and execute:

#### Using Python:
```bash
python -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

#### Using Node (npx):
```bash
npx http-server
```
Then navigate to the URL provided in the terminal output.

---

## Technologies Used

- **HTML5**: Structured semantic layout.
- **Vanilla CSS3**: Styling, custom variables, custom keyframe transitions, and animations.
- **Vanilla Javascript (ES6+)**: State management, Web Audio API synthesis, dynamic SVG node updates, and event coordination.
