let progress_add,
    addLength,
    boxEle_width_half,
    max_right,
    videoSpeed = 1, //当前的视频速度
    isPost = true; //是否为主线程发送信息
self.onmessage = (event) => {
    let message = event.data;
    //接收到的是个数组 根据数组长度及内容决定事件
    switch (message.length) {
        //暂停进度条位置的计算
        case 1:
            if (message[0] == "pause") {
                clearInterval(progress_add);
            } else if (message[0] == false) {
                isPost = false;
            } else if (message[0] == true) {
                isPost = true;
            } else {
                videoSpeed = message[0];
            }
            break;
        //根据该数组进行位置计算
        /* progress_first_move_width 发送时进度条的宽
		   isPost 是否给主线程发送更新的进度条宽 */
        case 2:
            clearInterval(progress_add);
            let progress_first_move_width = message[0];
            isPost = message[1];
            //每1/4秒将进度条和按钮位置信息更新并交给主线程 主线程根据信息更新进度条和按钮位置
            progress_add = self.setInterval(() => {
                //更新位置 = 发送数组位置 + 每秒移动距离 * 视频倍速
                let nowPlace_progress = `${(progress_first_move_width +=
                    addLength * videoSpeed).toFixed(2)}px`;
                let nowPlace_boxEle = `${(
                    parseFloat(nowPlace_progress) - boxEle_width_half
                ).toFixed(2)}px`;

                if (isPost) {
                    if (parseFloat(nowPlace_progress) < max_right) {
                        self.postMessage([nowPlace_progress, nowPlace_boxEle]);
                    }
                }
            }, 250);
            break;
        //传入初始化数组 传递必要的一些数据
        /* [进度条总长度 max_right
            视频总长度 allTime
            按钮宽度的一半 boxEle_width_half] */
        case 3:
            max_right = message[0];
            addLength = parseFloat((max_right / message[1] / 4).toFixed(4)); //精确到小数点后四位
            boxEle_width_half = message[2];
            break;
    }
};
