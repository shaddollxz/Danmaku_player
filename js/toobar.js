const mainwindow = document.querySelector(".MainWindow"); //所有元素的主容器
const boxEle = document.querySelector(".slider-runway"); //放按钮的容器
const biggerprogress = document.querySelector(".bigger-progress"); //进度条的点击区域
const progress = document.querySelector(".slider-progress"); //进度条
const video = document.querySelector("video"); //视频
const videoWindow = document.querySelector(".VideoWindow"); //放置视频以及弹幕墙的容器
const controlerMain = document.querySelector(".controler-main");
const controlers = document.querySelector(".controler").children; //工具栏中的所有标签

//用来记录当前时间
let videoSpeed = 1.0;
let allTime; //视频总时长
let timer = 0;
let timerInterval;
let max_right = mainwindow.clientWidth; //容器的最右边
const boxEle_width_half = boxEle.offsetWidth / 2; //box的一半宽度
function transTime(time) {
    let m = parseInt(time / 60);
    let s = (time % 60).toFixed();
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
boxEle.refreshPosition = function () {
    this.style.left = `${progress.offsetWidth - this.offsetWidth / 2}px`;
};

//#region 进度条增加的线程
const progress_worker = new Worker("./js/progressWorker.js");
progress_worker.onmessage = ({ data }) => {
    //根据进度条线程传过来的数据刷新位置
    progress.style.width = data[0];
    boxEle.style.left = data[1];
};
progress_worker.onerror = () => {
    console.log("进度条线程出错");
};

/* 给线程发送初始化数据 设置总时长 使用异步监控保证了alltime一定会加载出来 */
(() => {
    return new Promise((resolve, reject) => {
        video.oncanplay = () => {
            resolve(parseFloat(video.duration.toFixed(2)));
        };
    });
})().then((AllTime) => {
    allTime = AllTime;
    progress_worker.postMessage([max_right, AllTime, boxEle_width_half]);
    controlers[2].lastElementChild.innerText = transTime(AllTime);
});
//#endregion

//#region 拖动按钮时移动的实现
//一些必要的参数
/**
 * 进度条按钮能否移动
 */
let isMoveBox = false;
/**
 * 进度条按钮是否完成移动且是否离开屏幕
 */
let isFinished = true;
let box = null;
progress.style.width = "0px"; //第一次播放时进度条的width为空 这里初始化为0px

boxEle.addEventListener("mousedown", (event) => {
    event.stopPropagation();
    isMoveBox = true;
    isFinished = false;
    box = {
        progress_First_X: progress.offsetWidth, //点击时进度条的相对位置
        Mouse_First_X: event.clientX, //点击时鼠标的绝对位置
    };
    if (!video.paused) {
        progress_worker.postMessage([false]); //暂停刷新进度条 但是后台仍然在记录进度条应该在的位置
    }
});

biggerprogress.addEventListener("mousedown", (event) => {
    isMoveBox = true;
    isFinished = false;
    progress.style.width = `${event.layerX}px`;
    boxEle.refreshPosition();
    box = {
        progress_First_X: progress.offsetWidth, //点击时进度条跳到的相对位置
        Mouse_First_X: event.clientX, //点击时鼠标的绝对位置
    };
    if (!video.paused) {
        progress_worker.postMessage([false]);
    }
});

mainwindow.addEventListener("mousemove", (event) => {
    if (isMoveBox) {
        isFinished = false;
        let progress_move = event.clientX - box.Mouse_First_X;
        let progress_should_width = box.progress_First_X + progress_move;
        //限制progress的位置
        progress.style.width =
            progress_should_width < 0
                ? `0px`
                : progress_should_width > max_right
                ? `${max_right}px`
                : `${progress_should_width}px`;
        boxEle.refreshPosition();
    }
});

/* 该方法会和下面的video-click事件同时触发 用下面的判断来设置 */
mainwindow.addEventListener("mouseup", (event) => {
    //只有移动进度条才触发这个事件
    if (isMoveBox) {
        isMoveBox = false;
        isFinished = event.layerX < -boxEle_width_half || event.layerX > max_right ? false : true;
        //移动结束且进度条按钮没有离开屏幕
        if (isFinished) {
            /* 开始播放时向worker发送现在进度条指向的时间 */
            let persentage = parseFloat(
                (parseFloat(progress.style.width) / max_right).toFixed(4)
            ); //进度条占总长度的百分比(xx.xx%)
            let nowTime = parseFloat((allTime * persentage).toFixed()); //进度条现在指向的时间 以秒计算
            video.currentTime = timer = nowTime;
            controlers[2].firstElementChild.innerText = transTime(timer);
            if (!video.paused) {
                progress_worker.postMessage([parseFloat(progress.style.width), true]);
            }
            if (isHaveDanmaku) {
                danmaku_worker.postMessage(timer * 1000);
            }
        } else {
            progress_worker.postMessage([false]);
        }
    }
});

/* 拖动按钮移出屏幕时会恢复到原来的位置 */
mainwindow.addEventListener("mouseleave", () => {
    isMoveBox = false;
    if (!isFinished) {
        if (box) {
            progress.style.width = `${box.progress_First_X}px`;
            boxEle.refreshPosition();
            progress_worker.postMessage([true]);
            /* boxEle.style.left = `${box.Box_First_X}px`;
            progress.style.width = `${parseInt(boxEle.style.left) + boxEle_width_half}px`;
            progress_worker.postMessage([true]); */
        }
    }
});
//#endregion

//#region 视频的播放 暂停 点击事件
video.addEventListener("play", () => {
    console.log("play");
    controlers[0].innerHTML = `<i class="fas fa-pause fa-lg"></i>`;
    //如果此时按钮移动结束再触发进度条更新
    if (isFinished) {
        progress_worker.postMessage([parseFloat(progress.style.width), true]); //发送现在进度条的宽
    }
    /* 根据现在timer的时间给弹幕线程发送开始时间 */
    //isHaveDanmaku在danmaku里定义了 用来判断开始播放时有没有加载弹幕
    if (isHaveDanmaku) {
        tracks.playDanmaku();
        danmaku_worker.postMessage(timer * 1000);
    }
});
video.addEventListener("pause", () => {
    console.log("pause");
    controlers[0].innerHTML = `<i class="fa fa-play fa-lg"></i>`;
    progress_worker.postMessage(["pause"]);
    if (isHaveDanmaku) {
        tracks.pauseDanmaku();
        danmaku_worker.postMessage("pause");
    }
});

/* 进度条自动增加 视频播放 弹幕发射 */
videoWindow.addEventListener("click", (event) => {
    event.stopPropagation();
    if (video.paused) {
        video.play();
        //更新计时时间
        timerInterval = setInterval(() => {
            controlers[2].firstElementChild.innerText = transTime(~~video.currentTime);
        }, 1000);
    } else {
        video.pause();
        clearInterval(timerInterval);
    }
});
//#endregion

//#region 右键菜单及其它的菜单
//自定义一个菜单标签
class MainMenu extends HTMLElement {
    constructor() {
        super();
        this.isThere = true; //判断是否存在
        //点击到菜单阻止冒泡
        this.addEventListener("click", (event) => {
            event.stopPropagation();
            this.parentElement.removeChild(this);
            this.isThere = false;
        });
        let shadowroot = this.attachShadow({ mode: "open" });
        shadowroot.innerHTML = `<style>@import url(css/menu.css);`;
    }
    //根据Memu中的isDeleteSelf决定是否调用
    deleteSelf() {
        setTimeout(() => {
            if (this.isThere) {
                this.parentElement.removeChild(this);
            }
        }, 3000);
    }
}
customElements.define("my-menu", MainMenu);

/**用来接收参数实例化菜单
 * @param {number} width 该菜单的宽
 * @param {boolean} isDeleteSelf 是否有删除自己的功能
 * @param {object} button 菜单里的元素(第一个是显示的内容 第二个是事件 第三个是事件类型（默认点击）)
 * @return {object}		自定义的菜单标签
 */
class Menu {
    constructor(width, isDeleteSelf, ...button) {
        const main = document.createElement("span");
        main.style.width = `${width}px`;
        main.className = "main";
        let Buttons = {};
        for (let i = 0; i < button.length; i++) {
            const message = button[i];
            //确保按钮的内容不会重复 有重复的就是绑定多个事件
            if (!Buttons[message[0]]) {
                const option = document.createElement("div");
                option.innerText = message[0];
                option.addEventListener(message[2] || "click", message[1]);
                Buttons[message[0]] = option;
                main.appendChild(option);
            } else {
                const option = Buttons[message[0]];
                option.addEventListener(message[2] || "click", message[1]);
            }
        }
        Buttons = null;
        const menu = document.createElement("my-menu");
        menu.shadowRoot.appendChild(main);
        if (isDeleteSelf) {
            menu.deleteSelf();
        }
        return menu;
    }
}

//视频上的右键菜单
mainwindow.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    //实例化出菜单
    const menu = new Menu(
        180,
        true,
        [
            "第一",
            () => {
                console.log("1st");
            },
        ],
        [
            "第二",
            () => {
                console.log("2nd");
            },
        ]
    );
    menu.style.left = event.layerX + "px";
    menu.style.top = event.pageY - mainwindow.offsetTop + "px"; //在加载了弹幕通道后layerY拿到的是相对于通道的y轴 这里用鼠标相对于文档的绝对位置减去屏幕的高度得到的y轴
    menu.style.position = "absolute";
    mainwindow.appendChild(menu);
});
//#endregion

//#region 工具栏其它按钮
//#region 暂停-0-
controlers[0].addEventListener("click", (event) => {
    videoWindow.click();
    if (video.paused) {
        controlers[0].innerHTML = `<i class="fas fa-play fa-lg"></i>`;
    } else {
        controlers[0].innerHTML = `<i class="fa fa-pause fa-lg"></i>`;
    }
});
//#endregion
//#region 结束按钮-1-
controlers[1].addEventListener("click", () => {
    video.pause();
    controlers[0].innerHTML = `<i class="fas fa-play fa-lg"></i>`;
    timer = allTime;
    controlers[2].firstElementChild.innerText = transTime(timer);
    progress_worker.postMessage(["pause"]);
    if (isHaveDanmaku) {
        danmaku_worker.postMessage("pause");
    }
    video.currentTime = video.duration;
    progress.style.width = `${max_right}px`;
    boxEle.refreshPosition();
});
//#endregion
//#region 重新开始-3-
controlers[3].addEventListener("click", () => {
    timer = 0;
    controlers[2].firstElementChild.innerText = transTime(timer);
    video.currentTime = 0;
    progress.style.width = "0px";
    boxEle.style.left = "-8px";
    progress_worker.postMessage([0, true]);
    if (isHaveDanmaku) {
        danmaku_worker.postMessage(0);
    }
    if (video.paused) {
        progress_worker.postMessage(["pause"]);
        if (isHaveDanmaku) {
            danmaku_worker.postMessage("pause");
        }
    }
});
//#endregion
//#region 宽屏模式-5-
controlers[5].addEventListener("click", function () {
    let mainWindowClassName = mainwindow.className;
    if (mainWindowClassName.indexOf("small") > 0) {
        mainwindow.className = "MainWindow bigger";
        this.innerHTML = `<i class="fas fa-compress-alt fa-lg"></i>`;
        //更新进度条相关
        let progress_now_persent = progress.offsetWidth / max_right;
        max_right = mainwindow.offsetWidth;
        progress.style.width = `${progress_now_persent * max_right}px`;
        boxEle.refreshPosition();
        progress_worker.postMessage([max_right, allTime, boxEle_width_half]);
        if (!video.paused) {
            progress_worker.postMessage([parseFloat(progress.style.width), true]);
        }

        if (isHaveDanmaku) {
            tracks.copyto();
        }
    } else {
        mainwindow.className = "MainWindow small";
        this.innerHTML = `<i class="fas fa-expand-alt fa-lg"></i>`;
        let progress_now_persent = progress.offsetWidth / max_right;
        max_right = mainwindow.offsetWidth;
        progress.style.width = `${progress_now_persent * max_right}px`;
        boxEle.refreshPosition();
        progress_worker.postMessage([max_right, allTime, boxEle_width_half]);
        if (!video.paused) {
            progress_worker.postMessage([parseFloat(progress.style.width), true]);
        }

        if (isHaveDanmaku) {
            tracks.copyto();
        }
    }
});
//#endregion
//#region 全屏模式-4-
mainwindow.isFullScreen = false;
mainwindow.addEventListener("fullscreenchange", function () {
    this.isFullScreen = !this.isFullScreen;
});
controlers[4].addEventListener("click", function () {
    if (!mainwindow.isFullScreen) {
        mainwindow.requestFullscreen();
        this.innerHTML = `<i class="fas fa-compress fa-lg"></i>`;
    } else {
        document.exitFullscreen();
        this.innerHTML = `<i class="fas fa-expand fa-lg"></i>`;
    }
});
//#endregion
//#region 倍速-6-
controlers[6].isShow = false;
controlers[6].addEventListener("click", function () {
    //因为影子DOM的事件逃逸特性 只能设置按钮中的click事件不能在这个标签上用event.target来获得点击的内容
    function setProgressSpeed(event) {
        controlers[6].isShow = false;
        //这里出现了闭包 改的是全局的videoSpeed
        videoSpeed = parseFloat(event.target.innerText);
        video.playbackRate = videoSpeed;
        controlers[6].firstElementChild.innerText =
            videoSpeed == "1.0" ? "倍速" : event.target.innerText;
        progress_worker.postMessage([videoSpeed]); //修改进度条的刷新距离
        danmaku_worker.postMessage([videoSpeed]); //修改弹幕的检测速度
    }

    //第二次点击时隐藏自己
    if (this.isShow) {
        this.removeChild(this.lastElementChild);
        this.isShow = false;
    } else {
        const speedMenu = new Menu(
            55,
            false,
            ["2.0 X", setProgressSpeed],
            ["1.5 X", setProgressSpeed],
            ["1.25X", setProgressSpeed],
            ["1.0 X", setProgressSpeed],
            ["0.25X", setProgressSpeed],
            ["0.5 X", setProgressSpeed]
        );
        this.appendChild(speedMenu);
        speedMenu.style.left = "-10px";
        speedMenu.style.top = `-${
            //进度条高的一半 + 控件相对著控制台的高 + 菜单的高
            8 + 21 + speedMenu.offsetHeight
        }px`;
        speedMenu.style.position = "absolute";
        this.isShow = true;
    }
});
//#endregion
//#region 其它设置-7-
controlers[7].addEventListener("click", function () {
    if (this.isShow) {
        this.removeChild(this.lastElementChild);
        this.isShow = false;
    } else {
        const settingMenu = new Menu(
            150,
            false,
            [
                "弹幕墙高度",
                function () {
                    controlers[7].isShow = false;
                    const childMenu = new Menu(
                        75,
                        false,
                        [
                            "全屏弹幕",
                            () => {
                                if (isHaveDanmaku) {
                                    tracks.copyto();
                                }
                                controlers[7].removeChild(controlers[7].lastElementChild);
                            },
                        ],
                        [
                            "防挡字幕",
                            () => {
                                if (isHaveDanmaku) {
                                    tracks.copyto(1);
                                }
                                controlers[7].removeChild(controlers[7].lastElementChild);
                            },
                        ]
                    );
                    this.appendChild(childMenu);
                    childMenu.style.left = `${this.offsetLeft - childMenu.offsetWidth}px`;
                    childMenu.style.top = `${
                        this.offsetTop + this.offsetHeight / 3 - childMenu.offsetHeight //3是按钮数量加自己
                    }px`;
                    childMenu.style.position = "absolute";
                },
                "mouseenter",
            ],
            [
                "弹幕墙高度",
                function () {
                    controlers[7].removeChild(controlers[7].lastElementChild);
                },
                "mouseleave",
            ]
        );
        this.appendChild(settingMenu);
        settingMenu.style.left = "-30px";
        settingMenu.style.top = `-${
            //进度条高的一半 + 控件相对著控制台的高 + 菜单的高
            8 + 21 + settingMenu.offsetHeight
        }px`;
        settingMenu.style.position = "absolute";
        this.isShow = true;
    }
});
//#endregion
//#endregion

//#region 菜单自动隐藏
(function () {
    let interval = setInterval(() => {
        controlerMain.className = "controler-main controler-hide";
    }, 5000);
    mainwindow.addEventListener("mousemove", () => {
        if (controlerMain.className.indexOf(" ") > 0) {
        }
        clearInterval(interval);
    });
})();

//#endregion
