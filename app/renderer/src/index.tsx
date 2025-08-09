import React from "react";
import ReactDOM from "react-dom";
import { Provider } from "react-redux";
import store from "store";
import App from "./App";
import { setupPomodoroEventListeners } from "store/pomodoro/middleware";

import "index.css";
import "./extensions";

// Настройка Pomodoro event listeners
setupPomodoroEventListeners(store.dispatch);

ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById("app")
);
