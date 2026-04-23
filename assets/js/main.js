/*
 * Progressive enhancement only. The site must remain fully usable with
 * JavaScript disabled. Add behaviors here sparingly, and always behind a
 * feature check so a missing element does not throw.
 */
(function () {
  "use strict";

  const root = document.querySelector("[data-catalog-root]");
  if (!root) {
    return;
  }

  const apiBase = (root.getAttribute("data-api-base") || "").trim().replace(/\/$/, "");
  const statusNode = root.querySelector("[data-catalog-status]");
  const layoutNode = root.querySelector("[data-catalog-layout]");
  const gridNode = root.querySelector("[data-catalog-grid]");
  const cartMessageNode = root.querySelector("[data-cart-message]");
  const cartItemsNode = root.querySelector("[data-cart-items]");
  const cartSummaryNode = root.querySelector("[data-cart-summary]");
  const checkoutButton = root.querySelector("[data-cart-checkout]");
  const cart = new Map();
  let catalog = [];
  let checkoutBusy = false;
  const checkoutComplete = new URLSearchParams(window.location.search).get("checkout") === "success";

  if (checkoutComplete) {
    showStatus("Thanks. Square has your order and the shop can now fulfill it.", "success");
  }

  if (!apiBase) {
    showStatus("The online catalog is being configured. Please check back shortly.", "warning");
    return;
  }

  checkoutButton.addEventListener("click", checkoutCart);
  loadCatalog();

  async function loadCatalog() {
    showStatus("Loading the current catalog…");

    try {
      const response = await fetch(apiBase + "/catalog");
      if (!response.ok) {
        throw new Error("Catalog request failed.");
      }

      const payload = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error("Catalog payload is invalid.");
      }

      catalog = payload;
      if (catalog.length === 0) {
        layoutNode.hidden = true;
        showStatus("No books are currently available online. Please check back soon.", "warning");
        return;
      }

      renderCatalog();
      renderCart();
      layoutNode.hidden = false;
      if (checkoutComplete) {
        showStatus("Thanks. Square has your order and the shop can now fulfill it.", "success");
      } else {
        hideStatus();
      }
    } catch (error) {
      layoutNode.hidden = true;
      showStatus("The catalog is temporarily unavailable. Please try again later or contact the shop.", "danger");
    }
  }

  function renderCatalog() {
    gridNode.replaceChildren();

    catalog.forEach((item) => {
      const card = createElement("article", { className: "catalog-card" });

      if (item.c) {
        card.appendChild(createElement("p", { className: "catalog-card__category", text: item.c }));
      }

      const title = createElement("h3", { className: "catalog-card__title", text: item.n });
      card.appendChild(title);

      if (Array.isArray(item.m) && item.m.length > 0) {
        const gallery = createElement("div", { className: "catalog-card__gallery" });
        item.m.forEach((imageUrl, index) => {
          const image = createElement("img", {
            className: "catalog-card__image",
            attrs: {
              alt: index === 0 ? item.n : item.n + " alternate image " + (index + 1),
              loading: "lazy",
              src: imageUrl,
            },
          });
          gallery.appendChild(image);
        });
        card.appendChild(gallery);
      }

      card.appendChild(
        createElement("p", {
          className: "catalog-card__price",
          text: formatPrice(item.p),
        }),
      );

      if (item.d) {
        card.appendChild(
          createElement("p", {
            className: "catalog-card__description",
            text: item.d,
          }),
        );
      }

      card.appendChild(
        createElement("p", {
          className: "catalog-card__stock",
          text: item.q === 1 ? "1 copy available" : item.q + " copies available",
        }),
      );

      const controls = createElement("div", { className: "catalog-card__actions" });
      const labelId = "qty-" + item.v;
      controls.appendChild(
        createElement("label", {
          className: "catalog-card__label visually-hidden",
          attrs: { for: labelId },
          text: "Quantity for " + item.n,
        }),
      );

      const input = createElement("input", {
        className: "catalog-card__quantity field__control",
        attrs: {
          id: labelId,
          inputmode: "numeric",
          min: "1",
          max: String(item.q),
          step: "1",
          type: "number",
          value: "1",
        },
      });
      controls.appendChild(input);

      const button = createElement("button", {
        className: "button",
        attrs: { type: "button" },
        text: "Add to cart",
      });
      button.addEventListener("click", function () {
        addToCart(item, input);
      });
      controls.appendChild(button);
      card.appendChild(controls);

      gridNode.appendChild(card);
    });
  }

  function addToCart(item, input) {
    const quantity = clampQuantity(input.value, item.q);
    const current = cart.get(item.v) || 0;

    if (current + quantity > item.q) {
      showCartMessage(item.n + " no longer has that many copies available.", true);
      input.value = String(Math.max(1, item.q - current));
      return;
    }

    cart.set(item.v, current + quantity);
    input.value = "1";
    renderCart();
    showCartMessage(item.n + " added to cart.");
  }

  function renderCart() {
    cartItemsNode.replaceChildren();

    const selectedItems = catalog.filter((item) => cart.has(item.v));
    const totalCount = selectedItems.reduce((sum, item) => sum + cart.get(item.v), 0);
    const totalPrice = selectedItems.reduce((sum, item) => sum + item.p * cart.get(item.v), 0);

    selectedItems.forEach((item) => {
      const quantity = cart.get(item.v);
      const line = createElement("li", { className: "catalog-cart__item" });
      const meta = createElement("div", { className: "catalog-cart__item-meta" });
      meta.appendChild(createElement("p", { className: "catalog-cart__item-title", text: item.n }));
      meta.appendChild(
        createElement("p", {
          className: "catalog-cart__item-detail",
          text: quantity + " × " + formatPrice(item.p),
        }),
      );

      const controls = createElement("div", { className: "catalog-cart__item-controls" });
      controls.appendChild(stepperButton("−", function () { updateCart(item, quantity - 1); }, "Reduce quantity"));
      controls.appendChild(
        createElement("span", {
          className: "catalog-cart__item-count",
          text: String(quantity),
        }),
      );
      controls.appendChild(stepperButton("+", function () { updateCart(item, quantity + 1); }, "Increase quantity"));
      controls.appendChild(stepperButton("Remove", function () { updateCart(item, 0); }, "Remove book", "button--ghost"));

      line.appendChild(meta);
      line.appendChild(controls);
      cartItemsNode.appendChild(line);
    });

    checkoutButton.disabled = totalCount === 0 || checkoutBusy;
    cartSummaryNode.textContent =
      totalCount === 0
        ? ""
        : totalCount + (totalCount === 1 ? " book" : " books") + " • " + formatPrice(totalPrice);

    if (totalCount === 0) {
      showCartMessage("Add a book to begin checkout.");
    }
  }

  function updateCart(item, nextQuantity) {
    const clamped = clampQuantity(nextQuantity, item.q);
    if (nextQuantity <= 0) {
      cart.delete(item.v);
    } else {
      cart.set(item.v, clamped);
    }
    renderCart();
  }

  async function checkoutCart() {
    if (checkoutBusy || cart.size === 0) {
      return;
    }

    checkoutBusy = true;
    checkoutButton.disabled = true;
    checkoutButton.textContent = "Preparing checkout…";
    showCartMessage("Validating inventory and preparing checkout.");

    try {
      const response = await fetch(apiBase + "/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: catalog
            .filter((item) => cart.has(item.v))
            .map((item) => ({
              v: item.v,
              q: cart.get(item.v),
            })),
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload.u) {
        throw new Error(payload.error || "Checkout could not be created.");
      }

      window.location.assign(payload.u);
    } catch (error) {
      checkoutBusy = false;
      checkoutButton.disabled = false;
      checkoutButton.textContent = "Checkout";
      showCartMessage(error.message || "Checkout could not be created right now.", true);
    }
  }

  function showStatus(message, tone) {
    statusNode.hidden = false;
    statusNode.textContent = message;
    statusNode.className = "catalog-app__status callout";
    if (tone === "danger") {
      statusNode.classList.add("callout--danger");
    } else if (tone === "warning") {
      statusNode.classList.add("callout--warning");
    } else if (tone === "success") {
      statusNode.classList.add("callout--success");
    }
  }

  function hideStatus() {
    statusNode.hidden = true;
    statusNode.textContent = "";
    statusNode.className = "catalog-app__status callout";
  }

  function showCartMessage(message, isError) {
    cartMessageNode.textContent = message;
    cartMessageNode.classList.toggle("catalog-cart__message--error", Boolean(isError));
  }

  function stepperButton(label, onClick, title, extraClass) {
    const className = extraClass ? "button " + extraClass : "button";
    const button = createElement("button", {
      className: className,
      attrs: {
        type: "button",
        "aria-label": title,
      },
      text: label,
    });
    button.addEventListener("click", onClick);
    return button;
  }

  function createElement(tagName, options) {
    const element = document.createElement(tagName);
    if (options.className) {
      element.className = options.className;
    }
    if (options.text) {
      element.textContent = options.text;
    }
    if (options.attrs) {
      Object.keys(options.attrs).forEach(function (name) {
        element.setAttribute(name, options.attrs[name]);
      });
    }
    return element;
  }

  function clampQuantity(value, max) {
    const quantity = Number(value);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return 1;
    }
    return Math.min(quantity, max);
  }

  function formatPrice(amount) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount / 100);
  }
})();
