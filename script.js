let foulCommittedBy = null;
let isBotShooting = false;
let vsBot = false;
let globalFirstHitBall = null;
const canvas = document.getElementById("poolTable");
const ctx = canvas.getContext("2d");
const gameMessage = document.getElementById("gameMessage");
const instructions = document.getElementById("instructions");
const resetBtn = document.getElementById("resetBtn");
const turnMessage = document.getElementById("turnMessage");

// Sound effects
const sounds = {
    collision: new Audio("https://assets.mixkit.co/sfx/preview/mixkit-arcade-game-jump-coin-216.mp3"),
    pocket: new Audio("https://assets.mixkit.co/sfx/preview/mixkit-winning-chimes-2015.mp3"),
    win: new Audio("https://assets.mixkit.co/sfx/preview/mixkit-game-level-completed-2059.mp3"),
};

function playSound(name) {
    try {
        sounds[name].currentTime = 0;
        sounds[name].play();
    } catch (e) {
        console.log("Sound error:", e);
    }
}

class Ball {
    constructor(x, y, radius, color, number, isStriped) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.number = number;
        this.isStriped = isStriped;
        this.dx = 0;
        this.dy = 0;
        this.friction = 0.985;
        this.isPocketed = false;
        this.lastCollision = 0;
        this.pocketedBy = null;
        this.pocketTime = 0;
        this.wasHit = false;
    }

    draw() {
        if (this.isPocketed) return;

        // Draw ball shadow
        ctx.beginPath();
        ctx.arc(this.x + 2, this.y + 2, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.fill();

        // Draw ball
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();

        // Draw stripe if needed
        if (this.isStriped) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * 0.85, 0, Math.PI * 2);
            ctx.strokeStyle = "white";
            ctx.lineWidth = 4;
            ctx.stroke();
        }

        // Draw number
        ctx.fillStyle = this.number === 8 ? "white" : "black";
        ctx.font = "bold " + this.radius * 0.8 + "px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.number, this.x, this.y);
    }

    update(balls, pockets) {
        if (this.isPocketed) return;

        // Reset hit flag at start of each shot
        if (allBallsStopped()) {
            this.wasHit = false;
        }

        this.x += this.dx;
        this.y += this.dy;

        this.dx *= this.friction;
        this.dy *= this.friction;

        if (Math.abs(this.dx) < 0.05) this.dx = 0;
        if (Math.abs(this.dy) < 0.05) this.dy = 0;

        // Check for pocket collisions
        for (let pocket of pockets) {
            const dx = this.x - pocket.x;
            const dy = this.y - pocket.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < pocket.radius) {
                this.isPocketed = true;
                this.pocketedBy = currentPlayer;
                this.pocketTime = Date.now();
                handlePocketedBall(this);
                playSound("pocket");
                break;
            }
        }

        // Wall collisions
        if (!this.isPocketed) {
            if (this.x - this.radius < 0) {
                this.x = this.radius;
                this.dx = -this.dx * 0.9;
                playSound("collision");
            }
            if (this.x + this.radius > canvas.width) {
                this.x = canvas.width - this.radius;
                this.dx = -this.dx * 0.9;
                playSound("collision");
            }
            if (this.y - this.radius < 0) {
                this.y = this.radius;
                this.dy = -this.dy * 0.9;
                playSound("collision");
            }
            if (this.y + this.radius > canvas.height) {
                this.y = canvas.height - this.radius;
                this.dy = -this.dy * 0.9;
                playSound("collision");
            }
        }

        // Ball collisions
        const nearbyBalls = getNearbyBalls(this, balls);
        for (let otherBall of nearbyBalls) {
            if (this === otherBall || otherBall.isPocketed) continue;

            const dx = this.x - otherBall.x;
            const dy = this.y - otherBall.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const minDistance = this.radius + otherBall.radius;

            if (distance < minDistance && Date.now() - this.lastCollision > 50) {
                if (this.number === 0 && globalFirstHitBall === null) {
                    globalFirstHitBall = otherBall;
                }
                if (otherBall.number === 0 && globalFirstHitBall === null) {
                    globalFirstHitBall = this;
                }

                const angle = Math.atan2(dy, dx);
                const sin = Math.sin(angle);
                const cos = Math.cos(angle);

                const vx1 = this.dx * cos + this.dy * sin;
                const vy1 = this.dy * cos - this.dx * sin;
                const vx2 = otherBall.dx * cos + otherBall.dy * sin;
                const vy2 = otherBall.dy * cos - otherBall.dx * sin;

                const finalVx1 = vx2;
                const finalVx2 = vx1;

                this.dx = finalVx1 * cos - vy1 * sin;
                this.dy = vy1 * cos + finalVx1 * sin;
                otherBall.dx = finalVx2 * cos - vy2 * sin;
                otherBall.dy = vy2 * cos + finalVx2 * sin;

                const overlap = (minDistance - distance) / 2;
                this.x += overlap * (dx / distance);
                this.y += overlap * (dy / distance);
                otherBall.x -= overlap * (dx / distance);
                otherBall.y -= overlap * (dy / distance);

                this.lastCollision = Date.now();
                otherBall.lastCollision = Date.now();
                this.wasHit = true;
                otherBall.wasHit = true;
                playSound("collision");
            }
        }

        this.draw();
    }

    shoot(power, angle) {
        this.dx = power * Math.cos(angle);
        this.dy = power * Math.sin(angle);
        this.wasHit = true;
    }
}

class Cue {
    constructor() {
        this.length = 300;
        this.x = 0;
        this.y = 0;
        this.angle = 0;
        this.power = 0;
        this.isVisible = false;
        this.pullDistance = 0;
        this.maxPower = 50;

        this.length = 300; // Αυτή είναι η νέα γραμμή που προσθέτουμε
    }

    draw() {
        if (!this.isVisible) return;

        const cueBall = balls[0];
        const endX = cueBall.x + Math.cos(this.angle) * (this.length + 300);
        const endY = cueBall.y + Math.sin(this.angle) * (this.length + 300);

        // Γραμμή καθοδήγησης
        ctx.beginPath();
        ctx.moveTo(cueBall.x, cueBall.y);
        ctx.lineTo(endX, endY);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.save();
        ctx.translate(cueBall.x, cueBall.y);
        ctx.rotate(this.angle);

        // Σκιά
        ctx.beginPath();
        ctx.moveTo(-this.length - this.pullDistance, 8);
        ctx.lineTo(-30 - this.pullDistance, 8);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
        ctx.lineWidth = 14;
        ctx.lineCap = "round";
        ctx.stroke();

        // Κύριο σώμα
        const tipStart = -30 - this.pullDistance;
        const buttEnd = -this.length - this.pullDistance;

        const woodGradient = ctx.createLinearGradient(tipStart, 0, buttEnd, 0);
        woodGradient.addColorStop(0, "#6D4C41");
        woodGradient.addColorStop(0.4, "#8D6E63");
        woodGradient.addColorStop(0.7, "#D7CCC8");
        woodGradient.addColorStop(1, "#4E342E");

        ctx.beginPath();
        ctx.moveTo(tipStart, -8);
        ctx.lineTo(buttEnd, -8);
        ctx.lineTo(buttEnd, 8);
        ctx.lineTo(tipStart, 8);
        ctx.closePath();
        ctx.fillStyle = woodGradient;
        ctx.fill();

        // Μύτη
        const tipGradient = ctx.createRadialGradient(tipStart + 10, 0, 0, tipStart + 10, 0, 8);
        tipGradient.addColorStop(0, "#FFFFFF");
        tipGradient.addColorStop(0.7, "#E0E0E0");
        tipGradient.addColorStop(1, "#BCAAA4");

        ctx.beginPath();
        ctx.arc(tipStart + 10, 0, 6, 0, Math.PI * 2);
        ctx.fillStyle = tipGradient;
        ctx.fill();

        // Highlight μύτης
        ctx.beginPath();
        ctx.arc(tipStart + 12, -2, 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 255, 255, 0.8)";
        ctx.fill();

        // Διακοσμητικές λωρίδες
        const ringColors = ["#3E2723", "#5D4037", "#8D6E63"];
        const ringPositions = [-50, -100, -150, -200, -250];

        ringPositions.forEach((pos, i) => {
            if (pos < buttEnd) return;
            ctx.fillStyle = ringColors[i % ringColors.length];
            ctx.fillRect(pos - this.pullDistance, -7, 4, 14);
        });

        // Ανταύγεια
        ctx.beginPath();
        ctx.moveTo(tipStart, -4);
        ctx.lineTo(buttEnd, -4);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
    }

    update(x, y, angle, pullDistance) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.pullDistance = Math.min(pullDistance, 50);
        this.power = (this.pullDistance / 50) * this.maxPower;
        this.isVisible = true;
    }

    hide() {
        this.isVisible = false;
    }
}

// Game elements
const pockets = [
    // Γωνιακές (λίγο μεγαλύτερες)
    {
        x: 0,
        y: 0,
        radius: 38,
    },
    {
        x: canvas.width,
        y: 0,
        radius: 38,
    },
    {
        x: 0,
        y: canvas.height,
        radius: 38,
    },
    {
        x: canvas.width,
        y: canvas.height,
        radius: 38,
    },

    // Μεσαίες (λίγο μικρότερες)
    {
        x: canvas.width / 2,
        y: 0,
        radius: 32,
    },
    {
        x: canvas.width / 2,
        y: canvas.height,
        radius: 32,
    },
];

let balls = [];
let cue = new Cue();
let isShooting = false;
let startX, startY;
let foulMessage = "";
let isPlacingCueBall = false;
let currentPlayer = 1;
let player1Score = 0;
let player2Score = 0;
let player1Balls = [];
let player2Balls = [];
let isBreakPhase = true;
let player1Type = null;
let player2Type = null;
let gameOver = false;
let winner = null;
let foulTimer = null;
const gridSize = 50;
let grid = {};
let ballMessages = [];

function initGame() {
    const radius = 14;
    const spacing = radius * 2 + 1;
    const rackX = canvas.width * 0.75;
    const rackY = canvas.height / 2;

    balls = [];

    // Cue ball – αριστερά στο κέντρο
    balls.push(new Ball(canvas.width * 0.25, canvas.height / 2, radius, "white", 0, false));

    // Τριγωνική διάταξη 15 μπαλών
    const colors = [{
            color: "yellow",
            number: 1,
            striped: false,
        },
        {
            color: "blue",
            number: 2,
            striped: false,
        },
        {
            color: "red",
            number: 3,
            striped: false,
        },
        {
            color: "purple",
            number: 4,
            striped: false,
        },
        {
            color: "orange",
            number: 5,
            striped: false,
        },
        {
            color: "green",
            number: 6,
            striped: false,
        },
        {
            color: "maroon",
            number: 7,
            striped: false,
        },
        {
            color: "black",
            number: 8,
            striped: false,
        },
        {
            color: "yellow",
            number: 9,
            striped: true,
        },
        {
            color: "blue",
            number: 10,
            striped: true,
        },
        {
            color: "red",
            number: 11,
            striped: true,
        },
        {
            color: "purple",
            number: 12,
            striped: true,
        },
        {
            color: "orange",
            number: 13,
            striped: true,
        },
        {
            color: "green",
            number: 14,
            striped: true,
        },
        {
            color: "maroon",
            number: 15,
            striped: true,
        },
    ];

    let index = 0;
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col <= row; col++) {
            const x = rackX + row * spacing;
            const y = rackY - row * radius + col * 2 * radius;
            const { color, number, striped } = colors[index++];
            balls.push(new Ball(x, y, radius, color, number, striped));
        }
    }

    cue = new Cue();
    isShooting = false;
    foulMessage = "";
    isPlacingCueBall = false;
    currentPlayer = 1;
    player1Score = 0;
    player2Score = 0;
    player1Balls = [];
    player2Balls = [];
    isBreakPhase = true;
    player1Type = null;
    player2Type = null;
    gameOver = false;
    winner = null;
    grid = {};
    ballMessages = [];

    updateTurnMessage();
    gameMessage.textContent = "BREAK! Hit the balls hard!";
    instructions.textContent = "Drag mouse from cue ball to shoot";
    updateScores();
    updatePlayerBallsDisplay();
}

function updateGrid() {
    grid = {};
    for (let i = 0; i < balls.length; i++) {
        const ball = balls[i];
        if (ball.isPocketed) continue;

        const gridX = Math.floor(ball.x / gridSize);
        const gridY = Math.floor(ball.y / gridSize);
        const key = `${gridX},${gridY}`;

        if (!grid[key]) {
            grid[key] = [];
        }
        grid[key].push(ball);
    }
}

function getNearbyBalls(ball, balls) {
    const gridX = Math.floor(ball.x / gridSize);
    const gridY = Math.floor(ball.y / gridSize);
    const nearbyBalls = [];

    for (let x = gridX - 1; x <= gridX + 1; x++) {
        for (let y = gridY - 1; y <= gridY + 1; y++) {
            const key = `${x},${y}`;
            if (grid[key]) {
                nearbyBalls.push(...grid[key]);
            }
        }
    }

    return nearbyBalls.filter((b) => b !== ball && !b.isPocketed);
}

function isNearCueBall(mouseX, mouseY) {
    const cueBall = balls[0];
    const dx = mouseX - cueBall.x;
    const dy = mouseY - cueBall.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < 50 && !isPlacingCueBall && !gameOver && allBallsStopped();
}

function allBallsStopped() {
    return balls.every((ball) => {
        if (ball.isPocketed && ball.number !== 0) return true;
        if (ball.number === 0) return Math.abs(ball.dx) < 0.05 && Math.abs(ball.dy) < 0.05;
        return Math.abs(ball.dx) < 0.05 && Math.abs(ball.dy) < 0.05;
    });
}

function checkFoul() {
    const cueBall = balls[0];
    let isFoul = false;

    if (isBreakPhase) {
        if (cueBall.isPocketed) {
            foulMessage = "Foul! Cue ball pocketed.";
            isFoul = true;
        }
        return isFoul;
    }

    if (cueBall.isPocketed) {
        foulMessage = "Foul! Cue ball pocketed.";
        isFoul = true;
    }

    const firstHitBall = globalFirstHitBall;
    const currentPlayerBalls = currentPlayer === 1 ? player1Balls : player2Balls;
    const hasAllBallsPocketed = currentPlayerBalls.length === 7;

    if (hasAllBallsPocketed) return isFoul;

    if (!firstHitBall) {
        foulMessage = "Foul! No ball was hit.";
        isFoul = true;
    }

    if (!isFoul && player1Type && player2Type && firstHitBall) {
        const playerType = currentPlayer === 1 ? player1Type : player2Type;
        const isPlayerBall =
            (playerType === "solid" && !firstHitBall.isStriped) ||
            (playerType === "striped" && firstHitBall.isStriped);

        if (firstHitBall.number === 8) {
            foulMessage = "Foul! Hit the 8-ball too early.";
            isFoul = true;
        } else if (!isPlayerBall) {
            foulMessage = `Foul! Wrong ball hit (${firstHitBall.number}).`;
            isFoul = true;
        }
    }

    return isFoul;
}

function handlePocketedBall(ball) {
    if (ball.number === 0) return;

    // Αν μπήκε η μαύρη μπάλα
    if (ball.number === 8) {
        const currentPlayerBalls = currentPlayer === 1 ? player1Balls : player2Balls;
        const allBallsPocketed = currentPlayerBalls.length === 7;

        gameOver = true;

        if (allBallsPocketed) {
            winner = currentPlayer;
            gameMessage.textContent = `🎉 Player ${winner} wins! 🎱`;
        } else {
            winner = currentPlayer === 1 ? 2 : 1;
            gameMessage.textContent = `❌ Player ${winner} wins! (8-ball was pocketed too early)`;
        }

        instructions.textContent = "Restarting game in 3 seconds...";
        playSound("win");

        setTimeout(() => {
            initGame(); // Ξεκινά νέο παιχνίδι
        }, 3000);

        return;
    }

    // Καταγραφή μπάλας για τον γύρο
    ballsPocketedThisTurn.push(ball.number);

    // Αν δεν έχουν οριστεί οι τύποι παικτών
    if (player1Type === null && !isBreakPhase) {
        assignPlayerTypes(ball);
    }

    // Έλεγχος αν μπήκε μπάλα αντιπάλου
    if (player1Type !== null && player2Type !== null) {
        const opponentType = currentPlayer === 1 ? player2Type : player1Type;
        const isOpponentBall =
            (opponentType === "solid" && !ball.isStriped) ||
            (opponentType === "striped" && ball.isStriped);

        if (isOpponentBall) {
            foulMessage = "Foul! Pocketed opponent's ball.";
            isPlacingCueBall = true;
            instructions.textContent = "Click to place the cue ball";
            return;
        }
    }

    // Αν είναι έγκυρη μπάλα, καταχώρησέ την
    if (player1Type === null || player2Type === null || checkBallType(ball)) {
        const playerBalls = currentPlayer === 1 ? player1Balls : player2Balls;
        if (!playerBalls.includes(ball.number)) {
            playerBalls.push(ball.number);
            playerBalls.sort((a, b) => a - b);
            ballMessages.push({
                x: ball.x,
                y: ball.y,
                player: currentPlayer,
                time: Date.now(),
            });
        }
    } else {
        // Αν μπήκε λάθος τύπος μπάλας
        foulMessage = "Foul! Wrong ball pocketed.";
        isPlacingCueBall = true;
        instructions.textContent = "Click to place the cue ball";
        return;
    }

    updatePlayerBallsDisplay();
    updateScores();
}

function checkBallType(ball) {
    if (ball.number === 8) {
        const playerBalls = ball.pocketedBy === 1 ? player1Balls : player2Balls;
        return playerBalls.length === 7;
    }

    if (player1Type === null || player2Type === null) return true;

    const playerType = ball.pocketedBy === 1 ? player1Type : player2Type;
    return (
        (playerType === "solid" && !ball.isStriped) || (playerType === "striped" && ball.isStriped)
    );
}

function updatePlayerBallsDisplay() {
    const player1BallsDisplay = player1Balls.join(", ");
    const player2BallsDisplay = player2Balls.join(", ");

    if (player1Type && player2Type) {
        const player1TypeDisplay = player1Type === "solid" ? "Solids" : "Stripes";
        const player2TypeDisplay = player2Type === "solid" ? "Solids" : "Stripes";
        document.getElementById("player1Balls").textContent =
            `Player 1 Balls: ${player1BallsDisplay} (${player1TypeDisplay})`;
        document.getElementById("player2Balls").textContent =
            `Player 2 Balls: ${player2BallsDisplay} (${player2TypeDisplay})`;
    } else {
        document.getElementById("player1Balls").textContent = `Player 1 Balls: ${player1BallsDisplay}`;
        document.getElementById("player2Balls").textContent = `Player 2 Balls: ${player2BallsDisplay}`;
    }
}

function updateTurnMessage() {
    turnMessage.textContent = `Player ${currentPlayer}'s turn`;
    turnMessage.style.color = currentPlayer === 1 ? "#4CAF50" : "#F44336";
}

function updateScores() {
    player1Score = player1Balls.length;
    player2Score = player2Balls.length;
    document.getElementById("player1Score").textContent = `Player 1: ${player1Score}`;
    document.getElementById("player2Score").textContent = `Player 2: ${player2Score}`;
}

function assignPlayerTypes(firstBall) {
    if (player1Type !== null || player2Type !== null) return;

    const firstPlayer = firstBall.pocketedBy;

    if (firstBall.isStriped) {
        if (firstPlayer === 1) {
            player1Type = "striped";
            player2Type = "solid";
        } else {
            player2Type = "striped";
            player1Type = "solid";
        }
    } else {
        if (firstPlayer === 1) {
            player1Type = "solid";
            player2Type = "striped";
        } else {
            player2Type = "solid";
            player1Type = "striped";
        }
    }

    player1Balls.sort((a, b) => a - b);
    player2Balls.sort((a, b) => a - b);

    updateTurnMessage();
    updatePlayerBallsDisplay();
    gameMessage.textContent = "";
    isBreakPhase = false;
}

let ballsPocketedThisTurn = [];

function resetAfterShot() {
    const foulOccurred = checkFoul();

    if (foulOccurred) {
        foulCommittedBy = currentPlayer;
    } else {
        foulCommittedBy = null;
    }

    const pocketedThisShot = balls.filter(
        (ball) => ball.isPocketed && ball.number !== 0 && ball.pocketedBy === currentPlayer
    );

    if (isBreakPhase) {
        if (pocketedThisShot.length > 0) {
            assignPlayerTypes(pocketedThisShot[0]);
            isBreakPhase = false;
        }
        if (pocketedThisShot.length === 0 || foulOccurred) {
            currentPlayer = currentPlayer === 1 ? 2 : 1;
            updateTurnMessage();
        }
    } else {
        const playerType = currentPlayer === 1 ? player1Type : player2Type;

        const scoredValidBall = pocketedThisShot.some(
            (ball) =>
            (playerType === "solid" && !ball.isStriped) || (playerType === "striped" && ball.isStriped)
        );

        if (foulOccurred || ballsPocketedThisTurn.length === 0 || !scoredValidBall) {
            currentPlayer = currentPlayer === 1 ? 2 : 1;
            updateTurnMessage();
        }
    }

    updatePlayerBallsDisplay();
    updateScores();

    globalFirstHitBall = null;
    ballsPocketedThisTurn = [];
    isBotShooting = false;
    gameMessage.textContent = "";

    // ✅ ΤΩΡΑ κάνε τον ΕΛΕΓΧΟ για τοποθέτηση της μπάλα μετά την αλλαγή παίκτη
    if (foulOccurred) {
        if (vsBot) {
            // Αν ΤΟ BOT έκανε φάουλ και είναι η σειρά του παίκτη -> επιτρέπεται τοποθέτηση
            if (foulCommittedBy === 2 && currentPlayer === 1) {
                isPlacingCueBall = true;
                instructions.textContent = "Click to place the cue ball";
            } else {
                isPlacingCueBall = false;
            }
        } else {
            // Σε 2 παίκτες, πάντα ο επόμενος βάζει τη μπάλα
            isPlacingCueBall = true;
            instructions.textContent = "Click to place the cue ball";
        }
    } else {
        isPlacingCueBall = false;
        instructions.textContent = "Drag mouse from cue ball to shoot";
    }

    // ✅ Το bot να παίξει ΜΟΝΟ αν δεν έκανε φάουλ
    if (vsBot && currentPlayer === 2 && !gameOver) {
        if (foulCommittedBy !== 2) {
            setTimeout(botPlay, 1000);
        }
        // Καθάρισε το μήνυμα φάουλ μετά από λίγο, ακόμα κι αν δεν έγινε τοποθέτηση
        if (foulMessage) {
            setTimeout(() => {
                foulMessage = "";
            }, 2000);
        }
    }
}

function drawPockets() {
    pockets.forEach((pocket) => {
        // Σκιά από κάτω
        ctx.beginPath();
        ctx.arc(pocket.x + 2, pocket.y + 2, pocket.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fill();

        // Εσωτερική υφή τρύπας
        const gradient = ctx.createRadialGradient(
            pocket.x,
            pocket.y,
            pocket.radius * 0.3,
            pocket.x,
            pocket.y,
            pocket.radius
        );
        gradient.addColorStop(0, "#222");
        gradient.addColorStop(1, "#000");

        ctx.beginPath();
        ctx.arc(pocket.x, pocket.y, pocket.radius, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
    });
}

function drawTable() {
    // Υφή βελούδου: βαθύ gradient
    const felt = ctx.createRadialGradient(
        canvas.width / 2,
        canvas.height / 2,
        0,
        canvas.width / 2,
        canvas.height / 2,
        canvas.width
    );
    felt.addColorStop(0, "#0c3");
    felt.addColorStop(0.5, "#085e2f");
    felt.addColorStop(1, "#042b18");

    ctx.fillStyle = felt;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Σκούρο ξύλινο πλαίσιο με glossy look
    ctx.save();
    ctx.lineWidth = 30;
    const wood = ctx.createLinearGradient(0, 0, canvas.width, 0);
    wood.addColorStop(0, "#3e2723");
    wood.addColorStop(0.4, "#6d4c41");
    wood.addColorStop(0.6, "#8d6e63");
    wood.addColorStop(1, "#3e2723");

    ctx.strokeStyle = wood;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Διακεκομμένη γραμμή για break
    const cueLineX = canvas.width * 0.25;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(cueLineX, 0);
    ctx.lineTo(cueLineX, canvas.height);
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);

    // Διακριτικές λευκές κουκκίδες
    const dotStyle = ctx.createRadialGradient(0, 0, 0, 0, 0, 4);
    dotStyle.addColorStop(0, "#fff");
    dotStyle.addColorStop(1, "rgba(255,255,255,0)");
    const dots = [{
            x: canvas.width / 4,
            y: canvas.height / 4,
        },
        {
            x: (canvas.width * 3) / 4,
            y: canvas.height / 4,
        },
        {
            x: canvas.width / 2,
            y: canvas.height / 2,
        },
        {
            x: canvas.width / 4,
            y: (canvas.height * 3) / 4,
        },
        {
            x: (canvas.width * 3) / 4,
            y: (canvas.height * 3) / 4,
        },
    ];
    dots.forEach((dot) => {
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = dotStyle;
        ctx.fill();
        // Logo ή μοτίβο στη μέση
        // Premium logo στη μέση
        ctx.save();
        ctx.globalAlpha = 0.09;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(-Math.PI / 20);
        ctx.font = "bold 300px 'Great Vibes', cursive"; // Πιο έντονο
        ctx.fillStyle = "#FFD700";
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        ctx.font = "80px 'Great Vibes', cursive";
        ctx.fillStyle = "#f7ff04";
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
        ctx.shadowBlur = 10;
        ctx.fillText("8 Ball Pool", 0, 0);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#FFF";
        ctx.stroke();

        ctx.restore();
    });
}

function drawBallMessages() {
    const now = Date.now();
    ballMessages = ballMessages.filter((msg) => now - msg.time < 3000);

    ctx.font = "bold 16px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "white";

    ballMessages.forEach((msg) => {
        ctx.fillText(`P${msg.player}`, msg.x, msg.y - 20);
    });
}

// Event listeners
canvas.addEventListener("mousedown", (e) => {
    if (gameOver) return;
    if (vsBot && currentPlayer === 2) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isPlacingCueBall) {
        let validPosition = true;
        const cueBallRadius = balls[0].radius;

        // Check collision with other balls
        for (const ball of balls) {
            if (ball.isPocketed || ball.number === 0) continue;

            const dx = mouseX - ball.x;
            const dy = mouseY - ball.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < cueBallRadius * 3) {
                validPosition = false;
                break;
            }
        }

        // Check if within table bounds
        if (
            mouseX < cueBallRadius * 2 ||
            mouseX > canvas.width - cueBallRadius * 2 ||
            mouseY < cueBallRadius * 2 ||
            mouseY > canvas.height - cueBallRadius * 2
        ) {
            validPosition = false;
        }

        if (validPosition) {
            balls[0].x = mouseX;
            balls[0].y = mouseY;
            balls[0].isPocketed = false;
            balls[0].dx = 0;
            balls[0].dy = 0;
            isPlacingCueBall = false;
            foulMessage = "";
            instructions.textContent = "Drag mouse from cue ball to shoot";
        } else {
            foulMessage = "Invalid position! Try again.";
            setTimeout(() => {
                foulMessage = "";
            }, 2000);
        }
    } else if (isNearCueBall(mouseX, mouseY)) {
        isShooting = true;
        startX = mouseX;
        startY = mouseY;
    }
});

document.addEventListener("mousemove", (e) => {
    if (isShooting && !gameOver) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const dx = startX - mouseX;
        const dy = startY - mouseY;
        const angle = Math.atan2(dy, dx);
        const pullDistance = Math.sqrt(dx * dx + dy * dy);

        cue.update(startX, startY, angle, pullDistance);
    }
});

document.addEventListener("mouseup", (e) => {
    if (isShooting && !gameOver) {
        const cueBall = balls[0];
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const dx = startX - mouseX;
        const dy = startY - mouseY;
        const power = Math.min(Math.sqrt(dx * dx + dy * dy) / 5, cue.maxPower);
        const angle = Math.atan2(dy, dx);

        cueBall.shoot(power, angle);
        isShooting = false;
        cue.hide();

        // Check for stopped balls periodically
        const checkStopped = setInterval(() => {
            if (allBallsStopped()) {
                clearInterval(checkStopped);
                resetAfterShot();
            }
        }, 100);
    }
});

resetBtn.addEventListener("click", () => {
    location.reload();
});
// TOUCH START
canvas.addEventListener(
    "touchstart",
    (e) => {
        if (gameOver) return;
        if (vsBot && currentPlayer === 2) return;

        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const touchX = touch.clientX - rect.left;
        const touchY = touch.clientY - rect.top;

        if (isPlacingCueBall) {
            // ίδια λογική με το mousedown για cue ball placement
            // μπορείς να κάνεις extract σε κοινή συνάρτηση αν θες
        } else if (isNearCueBall(touchX, touchY)) {
            isShooting = true;
            startX = touchX;
            startY = touchY;
        }

        e.preventDefault(); // αποτρέπει scroll/zoom
    }, {
        passive: false,
    }
);

// TOUCH MOVE
document.addEventListener(
    "touchmove",
    (e) => {
        if (isShooting && !gameOver) {
            const touch = e.touches[0];
            const rect = canvas.getBoundingClientRect();
            const touchX = touch.clientX - rect.left;
            const touchY = touch.clientY - rect.top;

            const dx = startX - touchX;
            const dy = startY - touchY;
            const angle = Math.atan2(dy, dx);
            const pullDistance = Math.sqrt(dx * dx + dy * dy);

            cue.update(startX, startY, angle, pullDistance);
        }

        e.preventDefault(); // αποτρέπει scroll
    }, {
        passive: false,
    }
);

// TOUCH END
document.addEventListener(
    "touchend",
    (e) => {
        if (isShooting && !gameOver) {
            const cueBall = balls[0];

            const dx = cue.x - cueBall.x;
            const dy = cue.y - cueBall.y;
            const power = cue.power;
            const angle = cue.angle;

            cueBall.shoot(power, angle);
            isShooting = false;
            cue.hide();

            const checkStopped = setInterval(() => {
                if (allBallsStopped()) {
                    clearInterval(checkStopped);
                    resetAfterShot();
                }
            }, 100);
        }

        if (e.cancelable) e.preventDefault();
    }, {
        passive: false,
    }
);

function startGame(useBot) {
    vsBot = useBot;

    // Αποθήκευση στο session για refresh υποστήριξη
    sessionStorage.setItem("currentScreen", "game");
    sessionStorage.setItem("vsBot", useBot ? "true" : "false");

    // Ενημέρωση ιστορικού για back/forward
    history.pushState({
            gameStarted: true,
            vsBot: useBot,
        },
        "",
        "#game"
    );

    document.getElementById("mainMenu").style.display = "none";
    document.querySelector(".game-container").style.display = "flex";

    initGame();
    animate();
}

function botPlay() {
    const cueBall = balls[0];

    // Αν χρειάζεται να τοποθετηθεί cue ball, κάνε το bot να τοποθετήσει
    if (cueBall.isPocketed || isPlacingCueBall) {
        // Αναζήτησε έγκυρη θέση για cue ball
        let x, y, valid;
        const radius = cueBall.radius;

        do {
            valid = true;
            x = 100 + Math.random() * (canvas.width - 200);
            y = 100 + Math.random() * (canvas.height - 200);

            for (const ball of balls) {
                if (ball.isPocketed || ball.number === 0) continue;
                const dx = x - ball.x;
                const dy = y - ball.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < radius * 2.5) {
                    valid = false;
                    break;
                }
            }
        } while (!valid);

        cueBall.x = x;
        cueBall.y = y;
        cueBall.isPocketed = false;
        cueBall.dx = 0;
        cueBall.dy = 0;
        isPlacingCueBall = false;
    }

    if (!allBallsStopped()) return;

    isBotShooting = true;
    gameMessage.textContent = "🤖 Το Bot σκέφτεται...";

    const botType = currentPlayer === 2 ? player2Type : player1Type;

    if (!botType) {
        return simpleBotPlay(); // Αν δεν έχουν οριστεί τύποι, τυχαία βολή
    }

    const targetBalls = balls.filter(
        (ball) =>
        !ball.isPocketed &&
        ball.number !== 0 &&
        ball.number !== 8 &&
        ((botType === "solid" && !ball.isStriped) || (botType === "striped" && ball.isStriped))
    );

    let bestShot = null;
    let bestDistance = Infinity;

    for (const ball of targetBalls) {
        for (const pocket of pockets) {
            const dxBP = pocket.x - ball.x;
            const dyBP = pocket.y - ball.y;
            const distBP = Math.sqrt(dxBP * dxBP + dyBP * dyBP);

            const dxCB = ball.x - cueBall.x;
            const dyCB = ball.y - cueBall.y;
            const distCB = Math.sqrt(dxCB * dxCB + dyCB * dyCB);

            const totalDistance = distCB + distBP;

            if (totalDistance < bestDistance) {
                bestDistance = totalDistance;
                bestShot = {
                    ball,
                    pocket,
                };
            }
        }
    }

    if (!bestShot) {
        return simpleBotPlay(); // fallback
    }

    const { ball, pocket } = bestShot;

    const dx = pocket.x - ball.x;
    const dy = pocket.y - ball.y;
    const angleToPocket = Math.atan2(dy, dx);

    const contactX = ball.x - Math.cos(angleToPocket) * ball.radius * 1.5;
    const contactY = ball.y - Math.sin(angleToPocket) * ball.radius * 1.5;

    const shotDx = contactX - cueBall.x;
    const shotDy = contactY - cueBall.y;
    const shotAngle = Math.atan2(shotDy, shotDx);
    const power = 18 + Math.random() * 5;

    cueBall.shoot(power, shotAngle);

    const checkStopped = setInterval(() => {
        if (allBallsStopped()) {
            clearInterval(checkStopped);
            resetAfterShot();
        }
    }, 100);
}

function simpleBotPlay() {
    const cueBall = balls[0];
    if (cueBall.isPocketed) return;

    isBotShooting = true;
    gameMessage.textContent = "🤖 ";

    const targets = balls.filter(
        (ball) => !ball.isPocketed && ball.number !== 0 && ball.number !== 8
    );
    if (targets.length === 0) return;

    const target = targets[Math.floor(Math.random() * targets.length)];
    const dx = target.x - cueBall.x;
    const dy = target.y - cueBall.y;
    const angle = Math.atan2(dy, dx);
    const power = 10 + Math.random() * 15;

    cueBall.shoot(power, angle);

    const checkStopped = setInterval(() => {
        if (allBallsStopped()) {
            clearInterval(checkStopped);
            resetAfterShot();
        }
    }, 100);
}
// Κατά την αρχική φόρτωση ή ανανέωση σελίδας
window.addEventListener("load", function() {
    document.body.classList.remove("preload"); // ✅ Χρειάζεται για να εμφανίσει τα πάντα

    const screen = sessionStorage.getItem("currentScreen");
    const botMode = sessionStorage.getItem("vsBot") === "true";

    if (screen === "game") {
        vsBot = botMode;

        history.replaceState({
                gameStarted: true,
                vsBot: botMode,
            },
            "",
            "#game"
        );

        document.getElementById("mainMenu").style.display = "none";
        document.querySelector(".game-container").style.display = "flex";

        initGame();
        animate();
    } else {
        // Default fallback
        history.replaceState({
                gameStarted: false,
            },
            "",
            "/"
        );
        document.getElementById("mainMenu").style.display = "flex";
        document.querySelector(".game-container").style.display = "none";
    }
});

window.addEventListener("popstate", function(event) {
    if (event.state && event.state.gameStarted) {
        vsBot = event.state.vsBot;

        sessionStorage.setItem("currentScreen", "game");
        sessionStorage.setItem("vsBot", vsBot ? "true" : "false");

        document.getElementById("mainMenu").style.display = "none";
        document.querySelector(".game-container").style.display = "flex";

        initGame();
        animate();
    } else {
        sessionStorage.setItem("currentScreen", "menu");

        document.getElementById("mainMenu").style.display = "flex";
        document.querySelector(".game-container").style.display = "none";

        balls = [];
        cancelAnimationFrame(requestAnimationFrame);
    }
});

function animate() {
    //if (gameOver) return;

    drawTable();
    drawPockets();

    if (foulMessage) {
        ctx.fillStyle = "white";
        ctx.font = "24px Arial";
        ctx.textAlign = "center";
        ctx.fillText(foulMessage, canvas.width / 2, canvas.height / 2);
    }

    updateGrid();
    balls.forEach((ball) => ball.update(balls, pockets));
    drawBallMessages();

    const cueBall = balls[0];
    if (cueBall.isPocketed && !isPlacingCueBall) {
        foulMessage = "Foul! Place the cue ball.";
        isPlacingCueBall = true;
        instructions.textContent = "Click to place the cue ball";
    }

    updateScores();
    cue.draw();

    if (allBallsStopped() && !isShooting) {
        if (isBreakPhase) {
            gameMessage.textContent = "BREAK! Hit the balls hard!";
        } else {
            gameMessage.textContent = "";
        }
    }

    requestAnimationFrame(animate);
}

// Initialize game
//initGame();
animate();