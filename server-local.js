import app from './api/index.js';

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Local development backend running on http://0.0.0.0:${PORT}`);
});

// Keep event loop alive due to strange exit behavior
setInterval(() => {}, 1000 * 60 * 60);
