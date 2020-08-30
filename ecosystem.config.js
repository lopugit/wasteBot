module.exports = {
  apps : [
		{
			name: 'wasteBot',
			script: 'bot/index.js',
			instances: 1,
			autorestart: true,
			watch: 'bot/',
			max_memory_restart: '1G',
		}
	]
};
