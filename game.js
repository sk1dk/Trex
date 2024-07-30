const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Disable image filtering so that pixels are nice and crisp
ctx.imageSmoothingEnabled = false;
ctx.msImageSmoothingEnabled = false;
ctx.imageSmoothingQuality = "high";
ctx.msImageSmoothingQuality = "high";

const canvasWidth = canvas.width;
const canvasHeight = canvas.height;
const gridRows = 3;
const cellSize = canvasHeight / gridRows;
const cellWidth = cellSize;
const cellHeight = cellSize;

const difficultyRanges = {
    easy: { min: 12, max: 20 },
    medium: { min: 5, max: 15 },
    hard: { min: 2, max: 5 }
};
let difficulty = 'medium';

const moveDuration = 250; // Movement animation time
const visibleCols = Math.ceil(canvasWidth / cellWidth) + 2;

let player = {
    row: 1,
    col: 0,
    width: cellWidth - 10,
    height: cellHeight - 10,
    targetRow: 1,
    targetCol: 0,
    moveStartTime: 0,
    moving: false,
};

let camera = {
    xOffset: 0,
    targetXOffset: 0,
    smoothFactor: 0.1
};

let obstacles = [];
let gameOver = false;
let colsGenerated = 0;
let gameOverFlag = false;

let lastFrameTime = 0;

const playerImage = new Image();
const obstacleImages = [
    new Image(),
    new Image(),
    new Image(),
    new Image()
];
playerImage.src = 'img/player.png';
obstacleImages[0].src = 'img/obstacle1.png';
obstacleImages[1].src = 'img/obstacle2.png';
obstacleImages[2].src = 'img/obstacle3.png';
obstacleImages[3].src = 'img/obstacle4.png';

const occupiedPositions = {};
let deathTileCol = null;

function initializeDifficulty() {
    const savedDifficulty = localStorage.getItem('gameDifficulty');
    if (savedDifficulty)
        difficulty = savedDifficulty;
    else
        difficulty = 'medium';
    document.getElementById('difficultyDisplay').textContent = `Current Difficulty: ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`;
    generateInitialObstacles();
    placeDeathTile();
}

function setDifficulty(str) {
    difficulty = str;
    localStorage.setItem('gameDifficulty', difficulty);
    document.getElementById('difficultyDisplay').textContent = `Current Difficulty: ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`;
    restartGame();
}

initializeDifficulty();

function isPositionOccupied(row, col) {
    return occupiedPositions[col] && occupiedPositions[col].includes(row);
}

function addOccupiedPosition(row, col) {
    if (!occupiedPositions[col]) occupiedPositions[col] = [];
    occupiedPositions[col].push(row);
}

function getRandomObstacleSprite() {
    const sprites = obstacleImages;
    const randomIndex = Math.floor(Math.random() * sprites.length);
    return sprites[randomIndex];
}

function easeInOutCubic(t) {
    if ((t /= 0.5) < 1) return 0.5 * t * t * t;
    return 0.5 * ((t -= 2) * t * t + 2);
}

function drawGrid() {
    ctx.strokeStyle = 'rgba(0, 0, 0, 0)';

    for (let col = player.col - visibleCols; col <= player.col + 10; col++) {
        const x = col * cellWidth - camera.xOffset;
        for (let row = 0; row < gridRows; row++) {
            const y = row * cellHeight;

            if (col === player.col + 1 && row === player.row)
                ctx.fillStyle = 'rgba(245, 245, 245, 1)'; // Highlight grid color
            else
                ctx.fillStyle = 'rgba(255, 255, 255, 1)'; // Normal grid color

            if (x >= -cellWidth && x <= canvasWidth) {
                ctx.fillRect(x, y, cellWidth, cellHeight);
                ctx.strokeRect(x, y, cellWidth, cellHeight);
            }
        }
    }
}

function drawPlayer() {
    const elapsedTime = Date.now() - player.moveStartTime;
    const t = Math.min(elapsedTime / moveDuration, 1);
    const easedT = easeInOutCubic(t);

    const x = (player.col + easedT * (player.targetCol - player.col)) * cellWidth + 5 - camera.xOffset;
    const y = (player.row + easedT * (player.targetRow - player.row)) * cellHeight + 5;

    ctx.drawImage(playerImage, x, y, player.width, player.height);
}

function drawObstacles() {
    obstacles.forEach(obstacle => {
        const x = obstacle.col * cellWidth - camera.xOffset;
        const y = obstacle.row * cellHeight;
        if (x >= -cellWidth && x <= canvasWidth)
            ctx.drawImage(obstacle.sprite, x, y, cellWidth, cellHeight);

        if (player.row === obstacle.row && player.col === obstacle.col)
            gameOver = true;
    });

    if (deathTileCol !== null && player.row === 1 && player.col === deathTileCol)
        gameOver = true;
}

function generateObstacles() {
    for (let col = player.col + visibleCols; col < player.col + visibleCols + 5; col++) {
        if (Math.random() < 0.3) { // 30% chance to place an obstacle
            let row = Math.random() < 0.5 ? 0 : 2; // Randomly choose between top or bottom row

            if (!isPositionOccupied(row, col)) {
                obstacles.push({
                    row: row,
                    col: col,
                    sprite: getRandomObstacleSprite()
                });
                addOccupiedPosition(row, col);
            }
        }
    }
}

function generateInitialObstacles() {
    for (let col = 0; col < visibleCols; col++) {
        if (Math.random() < 0.9) { // 90% chance to place an obstacle
            let row = Math.random() < 0.5 ? 0 : 2; // Randomly choose between top or bottom row

            if (!isPositionOccupied(row, col)) {
                obstacles.push({
                    row: row,
                    col: col,
                    sprite: getRandomObstacleSprite()
                });
                addOccupiedPosition(row, col);
            }
        }
    }
}

function placeDeathTile() {
    const { min, max } = difficultyRanges[difficulty];
    const tilesBeforeDeath = Math.floor(Math.random() * (max - min + 1)) + min;
    deathTileCol = player.col + tilesBeforeDeath;
}

function handlePlayerMovement() {
    canvas.addEventListener('click', (event) => {
        if (gameOver) return;

        const clickX = event.clientX - canvas.offsetLeft;
        const clickY = event.clientY - canvas.offsetTop;
        const newRow = Math.floor(clickY / cellHeight);
        const newCol = Math.floor((clickX + camera.xOffset) / cellWidth);

        if (newCol === player.col + 1 && !player.moving) {
            const rowDifference = Math.abs(newRow - player.row);
            if (rowDifference === 0) {
                player.targetRow = newRow;
                player.targetCol = newCol;
                player.moveStartTime = Date.now();
                player.moving = true;

                // Adding/Removing columns offscreen
                if (player.col > visibleCols)
                    obstacles = obstacles.filter(obstacle => obstacle.col >= player.col - visibleCols + 1);

                colsGenerated++;
                generateObstacles();
            }
        }
    });
}

function updateCamera() {
    const offset = 300;
    const playerTargetXOffset = player.col * cellWidth - (canvasWidth / 2 - cellWidth / 2) + offset;
    camera.targetXOffset = playerTargetXOffset;
    camera.xOffset += (camera.targetXOffset - camera.xOffset) * camera.smoothFactor;
}

function updateMovement() {
    if (player.moving) {
        const elapsedTime = Date.now() - player.moveStartTime;
        const t = Math.min(elapsedTime / moveDuration, 1);
        const easedT = easeInOutCubic(t);

        if (t >= 1) {
            player.row = player.targetRow;
            player.col = player.targetCol;
            player.moving = false;
        }
    }
    updateCamera();
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = 'white';
    ctx.font = '30px "Comic Sans MS"';
    ctx.textAlign = 'center';
    ctx.fillText('Game Over', canvasWidth / 2, canvasHeight / 2 - 3);
    ctx.font = '15px "Comic Sans MS"';
    ctx.fillText('Click to restart', canvasWidth / 2, canvasHeight / 2 + 17);
}

canvas.addEventListener('click', (event) => {
    if (gameOver) restartGame();
});

function clearOccupiedPositions() {
    for (const col in occupiedPositions)
        delete occupiedPositions[col];
}

function restartGame() {
    player.row = 1;
    player.col = 0;
    player.targetRow = 1;
    player.targetCol = 0;
    player.moveStartTime = 0;
    player.moving = false;
    camera.xOffset = 0;
    obstacles = [];
    gameOver = false;
    gameOverFlag = false;
    colsGenerated = 0;
    lastFrameTime = 0;
    clearOccupiedPositions();
    generateInitialObstacles();
    placeDeathTile();
    mainLoop();
}

function update() {
    if (gameOver) {
        if (!gameOverFlag) {
            drawGameOver();
            gameOverFlag = true;
        }
    } else {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);
        drawGrid();
        drawPlayer();
        drawObstacles();
    }
}

function mainLoop(timestamp) {
    if (!lastFrameTime) lastFrameTime = timestamp;
    const deltaTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    updateMovement();
    update();
    requestAnimationFrame(mainLoop);
}

playerImage.onload = () => {
    let loadedImages = 0;
    obstacleImages.forEach(image => {
        image.onload = () => {
            loadedImages++;
            if (loadedImages === obstacleImages.length)
                mainLoop();
        };
        image.src = image.src;
    });
};

handlePlayerMovement();