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

  const STORAGE_KEY = "hermeticus.catalog.cart.v1";
  const DEFAULT_SORT = "category";
  const EMPTY_CART_MESSAGE = "Add a book to begin checkout.";
  const SUCCESS_MESSAGE = "Thanks. Square has your order and the shop can now fulfill it.";
  const apiBase = (root.getAttribute("data-api-base") || "").trim().replace(/\/$/, "");
  const statusNode = root.querySelector("[data-catalog-status]");
  const layoutNode = root.querySelector("[data-catalog-layout]");
  const gridNode = root.querySelector("[data-catalog-grid]");
  const emptyNode = root.querySelector("[data-catalog-empty]");
  const resultsNode = root.querySelector("[data-catalog-results]");
  const searchInput = root.querySelector("[data-catalog-search]");
  const categorySelect = root.querySelector("[data-catalog-category]");
  const sortSelect = root.querySelector("[data-catalog-sort]");
  const resetButton = root.querySelector("[data-catalog-reset]");
  const cartMessageNode = root.querySelector("[data-cart-message]");
  const cartItemsNode = root.querySelector("[data-cart-items]");
  const cartSummaryNode = root.querySelector("[data-cart-summary]");
  const checkoutButton = root.querySelector("[data-cart-checkout]");
  const lightboxDialog = root.querySelector("[data-catalog-lightbox]");
  const lightboxImage = root.querySelector("[data-lightbox-image]");
  const lightboxCaption = root.querySelector("[data-lightbox-caption]");
  const state = {
    browse: {
      search: "",
      category: "",
      sort: DEFAULT_SORT,
    },
    cart: new Map(),
    catalog: [],
    checkoutBusy: false,
    checkoutComplete: new URLSearchParams(window.location.search).get("checkout") === "success",
  };

  if (!apiBase) {
    showStatus("The online catalog is being configured. Please check back shortly.", "warning");
    return;
  }

  bindEvents();
  if (state.checkoutComplete) {
    clearCart();
    cleanupCheckoutQuery();
  }
  loadCatalog();

  function bindEvents() {
    searchInput.addEventListener("input", function () {
      state.browse.search = searchInput.value.trim();
      renderCatalogView();
    });

    categorySelect.addEventListener("change", function () {
      state.browse.category = categorySelect.value;
      renderCatalogView();
    });

    sortSelect.addEventListener("change", function () {
      state.browse.sort = sortSelect.value || DEFAULT_SORT;
      renderCatalogView();
    });

    resetButton.addEventListener("click", function (event) {
      event.preventDefault();
      resetBrowseControls();
      renderCatalogView();
    });

    checkoutButton.addEventListener("click", checkoutCart);

    if (lightboxDialog && typeof lightboxDialog.showModal === "function") {
      lightboxDialog.addEventListener("click", function (event) {
        if (event.target === lightboxDialog) {
          lightboxDialog.close();
        }
      });

      lightboxDialog.addEventListener("close", function () {
        lightboxImage.removeAttribute("src");
        lightboxImage.alt = "";
        lightboxCaption.textContent = "";
      });
    }
  }

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

      state.catalog = payload.filter(isCatalogItem).map(normalizeCatalogItem);
      if (state.catalog.length === 0) {
        layoutNode.hidden = true;
        showStatus("No books are currently available online. Please check back soon.", "warning");
        return;
      }

      populateCategoryOptions();
      restoreCart();
      renderCatalogView();
      renderCart();
      layoutNode.hidden = false;

      if (state.checkoutComplete) {
        showStatus(SUCCESS_MESSAGE, "success");
      } else {
        hideStatus();
      }
    } catch (error) {
      layoutNode.hidden = true;
      showStatus(
        "The catalog is temporarily unavailable. Please try again later or contact the shop.",
        "danger",
      );
    }
  }

  function populateCategoryOptions() {
    const fragment = document.createDocumentFragment();
    const categories = [...new Set(state.catalog.map((item) => item.c).filter(Boolean))].sort(
      function (left, right) {
        return left.localeCompare(right);
      },
    );

    categorySelect.replaceChildren(
      createElement("option", {
        attrs: { value: "" },
        text: "All categories",
      }),
    );

    categories.forEach(function (category) {
      fragment.appendChild(
        createElement("option", {
          attrs: { value: category },
          text: category,
        }),
      );
    });

    categorySelect.appendChild(fragment);
    categorySelect.value = state.browse.category;
    sortSelect.value = state.browse.sort;
  }

  function renderCatalogView() {
    const visibleItems = getVisibleItems();

    gridNode.replaceChildren();
    visibleItems.forEach(function (item) {
      gridNode.appendChild(buildCatalogCard(item));
    });

    emptyNode.hidden = visibleItems.length !== 0;
    gridNode.hidden = visibleItems.length === 0;
    resetButton.hidden = !hasActiveBrowseControls();
    resultsNode.textContent = buildResultsSummary(visibleItems.length);
  }

  function getVisibleItems() {
    const normalizedSearch = normalizeText(state.browse.search);

    return state.catalog
      .filter(function (item) {
        if (state.browse.category && item.c !== state.browse.category) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const haystack = normalizeText([item.n, item.c, item.d].filter(Boolean).join(" "));
        return haystack.includes(normalizedSearch);
      })
      .sort(compareCatalogItems);
  }

  function compareCatalogItems(left, right) {
    if (state.browse.sort === "title") {
      return left.n.localeCompare(right.n);
    }

    if (state.browse.sort === "price-asc") {
      return left.p - right.p || left.n.localeCompare(right.n);
    }

    if (state.browse.sort === "price-desc") {
      return right.p - left.p || left.n.localeCompare(right.n);
    }

    const categoryCompare = (left.c || "").localeCompare(right.c || "");
    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    return left.n.localeCompare(right.n);
  }

  function buildResultsSummary(visibleCount) {
    if (visibleCount === state.catalog.length && !hasActiveNarrowingControls()) {
      return visibleCount === 1 ? "Showing 1 book." : "Showing all " + visibleCount + " books.";
    }

    if (visibleCount === 0) {
      return "";
    }

    return (
      "Showing " +
      visibleCount +
      " of " +
      state.catalog.length +
      (state.catalog.length === 1 ? " book." : " books.")
    );
  }

  function buildCatalogCard(item) {
    const card = createElement("article", { className: "catalog-card" });

    if (item.m.length > 0) {
      card.appendChild(buildImageStrip(item));
    }

    const header = createElement("div", { className: "catalog-card__header" });
    if (item.c) {
      header.appendChild(
        createElement("p", {
          className: "catalog-card__category",
          text: item.c,
        }),
      );
    }

    header.appendChild(
      createElement("h3", {
        className: "catalog-card__title",
        text: item.n,
      }),
    );
    card.appendChild(header);

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
    const button = createElement("button", {
      className: "button catalog-card__button",
      attrs: { type: "button" },
      text: "Add to cart",
    });

    button.addEventListener("click", function () {
      addToCart(item);
    });

    controls.appendChild(button);
    card.appendChild(controls);
    return card;
  }

  function buildImageStrip(item) {
    const strip = createElement("div", { className: "catalog-card__gallery" });

    item.m.forEach(function (imageUrl, index) {
      const link = createElement("a", {
        className: "catalog-card__image-link",
        attrs: {
          href: imageUrl,
          "aria-label":
            item.n + (item.m.length > 1 ? ", image " + (index + 1) + " of " + item.m.length : ""),
        },
      });

      link.addEventListener("click", function (event) {
        if (openLightbox(imageUrl, item, index)) {
          event.preventDefault();
        }
      });

      link.appendChild(
        createElement("img", {
          className: "catalog-card__image",
          attrs: {
            alt: index === 0 ? item.n : item.n + ", alternate image " + (index + 1),
            loading: "lazy",
            src: imageUrl,
          },
        }),
      );

      strip.appendChild(link);
    });

    return strip;
  }

  function openLightbox(imageUrl, item, index) {
    if (!lightboxDialog || typeof lightboxDialog.showModal !== "function") {
      return false;
    }

    lightboxImage.src = imageUrl;
    lightboxImage.alt = item.n;
    lightboxCaption.textContent =
      item.m.length > 1
        ? item.n + " – image " + (index + 1) + " of " + item.m.length
        : item.n;

    try {
      lightboxDialog.showModal();
      return true;
    } catch (error) {
      return false;
    }
  }

  function addToCart(item) {
    const currentQuantity = state.cart.get(item.v) || 0;
    if (currentQuantity >= item.q) {
      showCartMessage(item.n + " no longer has another copy available.", true);
      return;
    }

    state.cart.set(item.v, currentQuantity + 1);
    persistCart();
    renderCart();
    showCartMessage(item.n + " added to cart.");
  }

  function renderCart() {
    const selectedItems = state.catalog.filter(function (item) {
      return state.cart.has(item.v);
    });
    const totalCount = selectedItems.reduce(function (sum, item) {
      return sum + state.cart.get(item.v);
    }, 0);
    const totalPrice = selectedItems.reduce(function (sum, item) {
      return sum + item.p * state.cart.get(item.v);
    }, 0);

    cartItemsNode.replaceChildren();
    selectedItems.forEach(function (item) {
      cartItemsNode.appendChild(buildCartLine(item));
    });

    checkoutButton.disabled = totalCount === 0 || state.checkoutBusy;
    checkoutButton.textContent = state.checkoutBusy ? "Preparing checkout…" : "Checkout";
    cartSummaryNode.textContent =
      totalCount === 0
        ? ""
        : totalCount + (totalCount === 1 ? " item" : " items") + " • " + formatPrice(totalPrice);

    if (totalCount === 0) {
      showCartMessage(EMPTY_CART_MESSAGE);
    } else {
      showCartMessage("");
    }
  }

  function buildCartLine(item) {
    const quantity = state.cart.get(item.v);
    const line = createElement("li", { className: "catalog-cart__item" });
    const meta = createElement("div", { className: "catalog-cart__item-meta" });
    const controls = createElement("div", { className: "catalog-cart__item-controls" });

    meta.appendChild(
      createElement("p", {
        className: "catalog-cart__item-title",
        text: item.n,
      }),
    );
    meta.appendChild(
      createElement("p", {
        className: "catalog-cart__item-detail",
        text: quantity + " × " + formatPrice(item.p),
      }),
    );

    controls.appendChild(
      stepperButton("−", function () {
        updateCart(item, quantity - 1);
      }, "Reduce quantity for " + item.n),
    );
    controls.appendChild(
      createElement("span", {
        className: "catalog-cart__item-count",
        text: String(quantity),
      }),
    );
    controls.appendChild(
      stepperButton("+", function () {
        updateCart(item, quantity + 1);
      }, "Increase quantity for " + item.n),
    );
    controls.appendChild(
      stepperButton(
        "Remove",
        function () {
          updateCart(item, 0);
        },
        "Remove " + item.n + " from the cart",
        "button--ghost",
      ),
    );

    line.appendChild(meta);
    line.appendChild(controls);
    return line;
  }

  function updateCart(item, nextQuantity) {
    if (nextQuantity <= 0) {
      state.cart.delete(item.v);
      persistCart();
      renderCart();
      showCartMessage(item.n + " removed from cart.");
      return;
    }

    const clampedQuantity = Math.min(nextQuantity, item.q);
    if (clampedQuantity !== nextQuantity) {
      showCartMessage(item.n + " no longer has that many copies available.", true);
    } else {
      showCartMessage(item.n + " quantity updated.");
    }

    state.cart.set(item.v, clampedQuantity);
    persistCart();
    renderCart();
  }

  async function checkoutCart() {
    if (state.checkoutBusy || state.cart.size === 0) {
      return;
    }

    state.checkoutBusy = true;
    renderCart();
    showCartMessage("Validating inventory and preparing checkout.");

    try {
      const response = await fetch(apiBase + "/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: state.catalog
            .filter(function (item) {
              return state.cart.has(item.v);
            })
            .map(function (item) {
              return {
                v: item.v,
                q: state.cart.get(item.v),
              };
            }),
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.u) {
        throw new Error(payload.error || "Checkout could not be created.");
      }

      window.location.assign(payload.u);
    } catch (error) {
      state.checkoutBusy = false;
      renderCart();
      showCartMessage(error.message || "Checkout could not be created right now.", true);
    }
  }

  function restoreCart() {
    const storedCart = readStoredCart();
    if (!storedCart) {
      return;
    }

    const catalogByVariation = new Map(
      state.catalog.map(function (item) {
        return [item.v, item];
      }),
    );

    state.cart.clear();
    Object.keys(storedCart).forEach(function (variationId) {
      const item = catalogByVariation.get(variationId);
      const quantity = Number(storedCart[variationId]);

      if (!item || !Number.isInteger(quantity) || quantity < 1) {
        return;
      }

      state.cart.set(variationId, Math.min(quantity, item.q));
    });

    persistCart();
  }

  function readStoredCart() {
    try {
      const rawValue = window.localStorage.getItem(STORAGE_KEY);
      if (!rawValue) {
        return null;
      }

      const parsed = JSON.parse(rawValue);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        clearCart();
        return null;
      }

      return parsed;
    } catch (error) {
      clearCart();
      return null;
    }
  }

  function persistCart() {
    try {
      const payload = {};
      state.cart.forEach(function (quantity, variationId) {
        payload[variationId] = quantity;
      });

      if (Object.keys(payload).length === 0) {
        window.localStorage.removeItem(STORAGE_KEY);
        return;
      }

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (error) {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch (storageError) {
        return;
      }
    }
  }

  function clearCart() {
    state.cart.clear();
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      return;
    }
  }

  function cleanupCheckoutQuery() {
    if (!window.history || typeof window.history.replaceState !== "function") {
      return;
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("checkout");
    const search = url.searchParams.toString();
    const nextUrl = url.pathname + (search ? "?" + search : "") + url.hash;
    window.history.replaceState({}, "", nextUrl);
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

  function resetBrowseControls() {
    state.browse.search = "";
    state.browse.category = "";
    state.browse.sort = DEFAULT_SORT;
    searchInput.value = "";
    categorySelect.value = "";
    sortSelect.value = DEFAULT_SORT;
  }

  function hasActiveBrowseControls() {
    return Boolean(
      state.browse.search || state.browse.category || state.browse.sort !== DEFAULT_SORT,
    );
  }

  function hasActiveNarrowingControls() {
    return Boolean(state.browse.search || state.browse.category);
  }

  function isCatalogItem(item) {
    return (
      item &&
      typeof item.v === "string" &&
      typeof item.n === "string" &&
      Number.isInteger(item.p) &&
      Number.isInteger(item.q) &&
      item.q > 0
    );
  }

  function normalizeCatalogItem(item) {
    return {
      c: typeof item.c === "string" ? item.c : "",
      d: typeof item.d === "string" ? item.d : "",
      i: typeof item.i === "string" ? item.i : "",
      m: Array.isArray(item.m)
        ? item.m.filter(function (imageUrl) {
            return typeof imageUrl === "string" && imageUrl.trim();
          })
        : [],
      n: item.n,
      p: item.p,
      q: item.q,
      v: item.v,
    };
  }

  function normalizeText(value) {
    return String(value || "").trim().toLocaleLowerCase();
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

  function formatPrice(amount) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount / 100);
  }
})();
