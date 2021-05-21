let danmakuWall = document.querySelector(".danmakuWall");
let tracks = document.createElement("div", { is: "div-tracks" }); //将它设为全局变量 弹幕div里也会用到
let file = document.querySelector("#file");
let isHaveDanmaku = false; //根据有无弹幕来判断是否发送视频时间给worker

//#region 继承一个div用来专门实例化弹幕
class Danmaku_div extends HTMLDivElement {
    constructor() {
        super();
    }

    get isOut() {
        //在调用时判断是否离开屏幕 左边的坐标加上自己的宽度小于通道的宽度时是离开屏幕
        if (this.offsetLeft + this.offsetWidth < tracks.offsetWidth) {
            return true;
        } else {
            return false;
        }
    }

    //#region 设置弹幕样式
    setStyle(message) {
        //设置专有样式
        this.class = message.where;
        this.style = message.style;
        this.innerText = message.text;
        this.userid = message.userId;
    }

    get class() {
        return this.getAttribute("class");
    }
    set class(str) {
        this.setAttribute("class", str);
    }

    get style() {
        return this.getAttribute("style");
    }
    set style(str) {
        this.setAttribute("style", str);
    }

    get userid() {
        return this.dataset.userid;
    }
    set userid(str) {
        this.setAttribute("data-userid", str);
    }
    //#endregion
}
customElements.define("div-danmaku", Danmaku_div, { extends: "div" });
//#endregion

//#region 继承一个div用来设置弹幕的弹道
class Tracks extends HTMLDivElement {
    constructor() {
        super();
        this.className = "tracks";
        this.deleteDanmaku();
        this.topBottomInterval;
        this.nowTopBottomElement;
    }
    //暂停全部弹幕
    pauseDanmaku() {
        for (let paused of this.parentElement.children) {
            paused.className = "pausedTracks";
            clearInterval(paused.topBottomInterval);
        }
    }
    //继续播放弹幕
    playDanmaku() {
        for (let paused of this.parentElement.children) {
            paused.className = "tracks";
            if (paused.nowTopBottomElement) {
                paused.topBottomInterval = setTimeout(() => {
                    paused.removeChild(paused.nowTopBottomElement);
                    paused.nowTopBottomElement = undefined;
                }, 2500);
            }
        }
    }
    //向弹道中填充弹幕
    addDanmaku(danmakuDiv, num) {
        if (danmakuDiv.className == "scroll") {
            //如果弹道的最后一个元素离开
            if (this.lastElementChild) {
                if (this.lastElementChild.isOut) {
                    this.appendChild(danmakuDiv);
                } else {
                    if (this.nextElementSibling) {
                        this.nextElementSibling.addDanmaku(danmakuDiv); //调用下一个兄弟元素的该方法
                    }
                }
            } else {
                this.appendChild(danmakuDiv);
            }
        } else if (danmakuDiv.className == "top") {
            if (!this.nowTopBottomElement) {
                this.appendChild(danmakuDiv);
                this.nowTopBottomElement = danmakuDiv;
                //两秒后删除添加的元素
                this.topBottomInterval = setTimeout(() => {
                    this.removeChild(danmakuDiv);
                    this.nowTopBottomElement = undefined;
                }, 2500);
            } else {
                if (this.nextElementSibling) {
                    this.nextElementSibling.addDanmaku(danmakuDiv);
                }
            }
        } else if (danmakuDiv.className == "bottom") {
            let lastElem = this.parentElement.lastElementChild;
            for (let i = 0; i < num; i++) {
                lastElem = lastElem.previousSibling;
            }
            if (!lastElem.nowTopBottomElement) {
                lastElem.appendChild(danmakuDiv);
                lastElem.nowTopBottomElement = danmakuDiv;
                lastElem.topBottomInterval = setTimeout(() => {
                    lastElem.removeChild(danmakuDiv);
                    lastElem.nowTopBottomElement = undefined;
                }, 2500);
            } else {
                this.addDanmaku(danmakuDiv, ++num);
            }
        }
    }
    //删除弹幕
    deleteDanmaku() {
        setInterval(() => {
            if (this.firstElementChild) {
                //第一个子元素的坐标是整个弹道的-1.5倍时（这时动画停止）
                //如果修改这里的1.5记得改css里动画的结束位置
                if (this.firstElementChild.offsetLeft <= -1.5 * this.offsetWidth + 2) {
                    this.removeChild(this.firstElementChild);
                    console.log("delete success");
                }
            }
        }, 250);
    }
    //修改弹幕墙高度
    copyto(setChange = 0) {
        let nowTracks = this.parentElement.childElementCount; /* parent.childElementCount; */
        let num = this.parentElement.offsetHeight / (32 + 9) - setChange;
        if (nowTracks < num) {
            let fragment = document.createDocumentFragment();
            for (let i = 0; i < num - nowTracks; i++) {
                fragment.appendChild(document.importNode(this, true));
            }
            this.parentElement.appendChild(fragment);
            fragment = null;
        } else if (nowTracks > num) {
            for (let i = 0; i < nowTracks - num - 1; i++) {
                this.parentElement.removeChild(this.parentElement.lastElementChild);
            }
        }
    }
    /* copy(num) {
        let fragment = document.createDocumentFragment();
        for (let i = 0; i < num; i++) {
            fragment.appendChild(document.importNode(this, true));
        }
        this.parentElement.appendChild(fragment);
        fragment = null;
    } */
}
customElements.define("div-tracks", Tracks, { extends: "div" });
//#endregion

//#region 创建一个线程用来处理弹幕
let danmaku_worker = new Worker("./js/danmakuWorker.js");
danmaku_worker.onmessage = ({ data }) => {
    //接收到发来的字符串后用它实例化弹幕
    let danmaku = document.createElement("div", { is: "div-danmaku" });
    danmaku.setStyle(data);
    tracks.addDanmaku(danmaku);
};
danmaku_worker.onerror = () => {
    console.error("线程操作失败");
};
//#endregion

//#region 选择弹幕文件并转为map发送给线程 再生成弹幕墙
//重写一个filereader 使它有一个能被监听的onload
class MyFileReader extends FileReader {
    constructor() {
        super();
    }
    //监听reader.onload 或 error
    readonload() {
        const load = new Promise((resolve, reject) => {
            this.onload = (event) => {
                resolve(event.target.result); //解决是读取到的文本数据
            };
            this.onerror = () => {
                reject("read xml error");
            };
        });
        return load; //在onload执行完后才会resolve 而await只会等它为resolve时才会返回
    }
}

file.addEventListener("change", async (event) => {
    let file = event.target.files[0];

    let reader = new MyFileReader();

    //判断是否是xml文件
    if (file.type.indexOf("xml") >= 0) {
        reader.readAsText(file);
    } else {
        return "this file not is xml file";
    }

    //使用上面写的监听 让下面能对读取到的字符串处理
    let xmltxt = await reader.readonload();

    /* 将字符串转为dom */
    //将xml的version从2.0改为1.0
    if (xmltxt.indexOf("version") < xmltxt.indexOf("2.0") < xmltxt.indexOf("encoding")) {
        xmltxt = xmltxt.replace("2.0", "1.0");
    }
    let parser = new DOMParser();
    let xmldom = parser.parseFromString(xmltxt, "text/xml");

    //对xmldom进行处理 放入map
    //在工作者线程中不能进行DOM操作 所以在主线程中进行设置map的操作
    let eleD = xmldom.querySelectorAll("d");
    let danmaku_map = new Map();
    for (const ele of eleD) {
        //获得弹幕的属性 同时把内容放到最后
        let attrP = ele.getAttribute("p");
        attrP += `,${ele.innerHTML}`;
        //修改时间以100ms为间隔 有重复的时间+100ms
        /* 如果要修改间隔时间记得也要改danmakuWorker里的时间 */
        let time = parseInt(attrP.split(",")[2] / 100) * 100;
        while (danmaku_map.has(time)) {
            time += 100;
        }
        danmaku_map.set(time, attrP);
    }
    //创建完成后发给弹幕线程来读取 同时创建弹幕墙
    if (danmaku_map) {
        console.log("danmakuWall create success");
        danmaku_worker.postMessage(danmaku_map);
        isHaveDanmaku = true;
        danmakuWall.innerHTML = `<style>@import url(./css/danmaku.css);</style>`;
        danmakuWall.appendChild(tracks);
        tracks.copyto();
    }
});
//#endregion

//#region 弹幕的点击事件托管在弹幕墙上
danmakuWall.addEventListener(
    "click",
    (event) => {
        let target = event.target;
        switch (target.className) {
            case "scroll":
            case "top":
            case "bottom":
                event.stopPropagation();
                console.log(target);
        }
    },
    true
);
//#endregion
