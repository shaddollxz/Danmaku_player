//#region 获取setting.json中的弹幕设置

//#endregion

//#region 获取主线程传递的数据 结合弹幕设置用来生成弹幕的各项属性
let firstTime,
	danmaku_map,
	loopshoot,
	videoSpeed = 1;

self.onmessage = ({ data }) => {
	switch (typeof data) {
		case "number":
			firstTime = data;
			//每100ms对map检查有无指定时间的数据 如果有就发回主线程
			clearInterval(loopshoot);
			loopshoot = setInterval(() => {
				if (danmaku_map.has(firstTime)) {
					let danmaku_message = danmaku_map.get(firstTime).split(",");
					let useful_danmaku_message = {
						where:
							danmaku_message[3] == "1"
								? "scroll"
								: danmaku_message[3] == "5"
								? "top"
								: "bottom",

						style: `;font-size: ${danmaku_message[4]}px
								; color: #${parseInt(danmaku_message[5]).toString(16)}
								;text-shadow: ${"black 1px 0px 0.5px"}`,

						userId: danmaku_message[8],
						text: danmaku_message[9],
					};
					self.postMessage(useful_danmaku_message);
				}
				firstTime += 100;
			}, 100 / videoSpeed); //检测弹幕的事件间隔 两倍速就是50ms检测一次
			break;
		case "string":
			clearInterval(loopshoot);
			break;
		case "object":
			if (data.length == 1) {
				videoSpeed = data[0];
			} else {
				danmaku_map = data;
			}
	}
};
//#endregion
