# pfork
用于在后台运行程序中启动一个进程执行相应的脚本

# Installation

	npm install pfork --save
	
# Usage
	var p = require('pfork');
	var options = {
		script: '/User/xxx/test/script.js',
		value: '/User/xxx/test/server.js',
		//其它字段
	};
	p.fork(options, function(err, data) {
		//启动结束
	});
	
/User/xxx/test/script.js

	//options与fork的options字段一致
	module.exports = function(options, callback) {
		//do sth
		callback(err, data);
	}；