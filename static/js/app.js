"use strict";

var UI_handler = {
  name: undefined,
  log: function(msg){
    this.control.innerHTML = this.control.innerHTML + msg + '<br/>';
  },
  update_ui: function(){
    if (WS_handler.conn == null) {
      this.status_p.innerHTML = "Disconnected";
      this.connect_btn.innerHTML = "Reconnect"
    } else {
      this.status_p.innerHTML = 'Connected (' + WS_handler.conn.protocol + ')';
      this.connect_btn.innerHTML = 'Disconnect'
    }
    document.getElementById('name').innerHTML = this.name;
  },
  init: function(){
    let self = this;
    document.getElementById('parent_list').style.height = window.innerHeight * 0.6 + "px";
    document.getElementById("add_task").onclick = ask_add_item;
    this.control = document.getElementById('log');
    this.status_p = document.getElementById('status');
    this.connect_btn = document.getElementById('connect_btn');
    document.getElementById('dispay_log').onclick = function(){
      let div_log = document.getElementById('parent_log');
      div_log.style.display = div_log.style.display === "none" ? null : "none";
    };
    this.connect_btn.onclick = function(){
      if(WS_handler.conn === null){
        WS_handler.connect();
      } else {
        WS_handler.disconnect();
      }
      self.update_ui();
    };
    swal({
        title: "",
        text: "Type your name",
        type: "info",
        showCancelButton: false,
        showCloseButton: false,
        allowEscapeKey: false,
        allowOutsideClick: false,
        confirmButtonColor: "#DD6B55",
        confirmButtonText: "Ok!",
        input: 'text',
        inputPlaceholder: "John Doe",
        inputValidator: function(value) {
            return new Promise(function(resolve, reject){
                if(value.length == 0){
                    reject("A name ...!");
                } else { resolve(); }
            });
        }
      }).then( value => {
            self.name = value;
            self.update_ui();
            WS_handler.connect();
        }, dismiss => {
            console.log(dismiss);
        });
  },
  display_notification: function(message){
    if(!this.cancel_next_notification)
      Notifier.info(message, "");
    else {
      this.cancel_next_notification = false;
    }
  },
  cancel_next_notification: false
}

var WS_handler = {
  connect: function(){
    let self = this;
    this.disconnect();
    try {
        this.conn = new WebSocket('ws://' + window.location.host + '/ws_todolist');
    } catch(err){
      console.log(err);
      try {
        this.conn = new WebSocket('wss://' + window.location.host + '/ws_todolist');
        } catch(err2){
          console.log(err2)
        };
    }
    UI_handler.cancel_next_notification = true;
    UI_handler.log('Connecting...');
    this.conn.onopen = function() {
        UI_handler.log('Connected.');
        UI_handler.update_ui();
    };
    this.conn.onmessage = function(e) {
        var data = JSON.parse(e.data);
        switch (data.action) {
            case 'connect':
                self.name = data.name;
                UI_handler.log('Connected as ' + name);
                UI_handler.update_ui();
                request_list();
                break;
            case 'change_list':
                UI_handler.display_notification("Todo list updated");
                let new_list = data.todo_list;
                UI_handler.log('Refresh todolist');
                UI_handler.update_ui();
                update_list(new_list);
                break;
            case 'disconnect':
                self.name = data.name;
                UI_handler.log('Disconnected ' + name);
                UI_handler.update_ui();
                break;
            }
        };
  },
  disconnect: function(){
    if (this.conn != null) {
      UI_handler.log('Disconnecting...');
      this.conn.close();
      this.conn = null;
      this.name = 'UNKNOWN';
      UI_handler.update_ui();
    }
  },
  conn: null,
  name: undefined
}

// var TaskLiskHandler = {
//   init: function(){
//
//   },
//   update: function(){
//
//   },
//   remove_item: function(){
//
//   },
//   add_item: function(){
//
//   }
// };

function request_list(){
  if(!WS_handler.conn) return;
  WS_handler.conn.send(JSON.stringify({ 'action': 'get_list' }));
}

function update_list(new_list){
  let keys = Object.getOwnPropertyNames(new_list),
      nb_items = keys.length,
      todo_list = document.getElementById("todo_list");
  todo_list.innerHTML = "";
  for(let i = 0; i < nb_items; i++){
      let key = keys[i],
          item_list = new_list[key],
          li_elem = document.createElement("li");
      li_elem.id = key;
      li_elem.innerHTML = '<input class="toggle" type="checkbox"><span class="destroy"></span>' +
                          '<p id="task_content"><b>' + item_list.description + '</b></p>' +
                          '<p style="font-size:8.5px;"><em>' + item_list.author + ", " + item_list.date_added + "</em></p>";
      li_elem.querySelector(".destroy").onclick = function(){
        remove_item_list(this.parentElement.id, item_list.description);
      }
      li_elem.onmouseover = function(){
        this.querySelector('.destroy').style.display = "inline-block";
      }
      li_elem.onmouseout = function(){
        this.querySelector('.destroy').style.display = "none";
      }
      todo_list.appendChild(li_elem);
  }
  document.getElementById('count_items').innerHTML = nb_items > 1 ? nb_items + " tasks" : nb_items + " task";
}

function ask_add_item(){
  swal({
      title: "",
      text: "Task to be done",
      type: "question",
      showCancelButton: true,
      showCloseButton: false,
      allowEscapeKey: false,
      allowOutsideClick: false,
      confirmButtonColor: "#DD6B55",
      confirmButtonText: "Add it!",
      input: 'text',
      inputPlaceholder: "Coffee ?",
      inputValidator: function(value) {
          return new Promise(function(resolve, reject){
              if(value.length == 0){
                  reject("A task ...!");
              } else { resolve(); }
          });
      }
    }).then( value => {
        add_item_list(value);
      }, dismiss => {
          null;
      });
}

function add_item_list(item_description){
  WS_handler.conn.send(JSON.stringify({
    action: 'add_item_list',
    new_item: {
      author: UI_handler.name,
      description: item_description,
      date_added: new Date(Date.now()).toLocaleString()
    }
  }));
}

function remove_item_list(item_id, item_description){
  swal({
    type: "question", title: "",
    text: "Remove item " + item_description + " ?",
    allowOutsideClick: false, allowEscapeKey: true,
    showConfirmButton: true, showCancelButton: true,
    confirmButtonText: "yes", cancelButtonText: "no"
  }).then(() => {
    WS_handler.conn.send(JSON.stringify({ action: 'remove_item_list', ix: item_id }));
  }, dismiss => { null; });
}
