module.exports = {
	apps: [
		{
			name: 'watchtogtr-backend',
			cwd: 'backend',
			script: 'npm',
			args: 'start',
			interpreter: 'none',
			instances: 1,
			exec_mode: 'fork',
			autorestart: true,
			watch: false,
			env: {
				NODE_ENV: 'production',
			},
			error_file: 'backend/logs/pm2-error.log',
			out_file: 'backend/logs/pm2-out.log',
			time: true,
		},
	],
};
