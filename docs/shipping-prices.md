# Shipping Price Guide

Shipping is calculated automatically from the **Shipping weight (lb)** field on each catalog item. Administrators do not need to enter a separate shipping price for each product.

The value entered in the Shipping Weight field determines which shipping method the system uses.

## 1. Choose the correct item setup

| Item type | Shipping Weight setting | Shipping behavior |
| - | - | - |
| Standard book | Leave blank | Uses item-count shipping |
| Heavy book or other weight-priced item | Enter its actual weight in pounds | Uses weight-based shipping |
| Postcard or other free-shipping item | Enter `0.1` pounds or less | Ships free and is excluded from shipping calculations |

A blank Shipping Weight field is different from entering `0`:

* **Blank** means the item uses item-count shipping.
* **0.1 pounds or less** means the item ships free.

Do not enter `0.1` pounds for an item unless it is supposed to receive free shipping.

# Recipe 1: Standard books

For a standard book that should use the normal item-count rate:

1. Open the catalog item.
2. Leave the **Shipping Weight** field blank.
3. Save the item.

When an order contains these items, shipping is based on the number of qualifying items in the order.

## Item-count shipping rates

| Number of items | Shipping price |
| --------------: | -------------: |
|               1 |             $5 |
|               2 |             $6 |
|               3 |             $7 |
|               4 |             $8 |
|               5 |             $9 |
|               6 |            $10 |
|               7 |            $11 |
|               8 |            $12 |
|               9 |            $13 |
|              10 |            $14 |
|              11 |            $15 |
|              12 |            $16 |
|              13 |            $17 |
|              14 |            $18 |
|              15 |            $19 |
|              16 |            $20 |
|              17 |            $21 |
|              18 |            $22 |
|              19 |            $23 |
|              20 |            $24 |
|              21 |            $25 |
|              22 |            $26 |
|              23 |            $27 |
|              24 |            $28 |
|      25 or more |            $30 |

For orders of 1 through 24 items, the rate can also be calculated as:

**Shipping price = $4 + number of items**

Orders containing 25 or more qualifying items are charged $30.

# Recipe 2: Heavy books and weight-priced items

Enter an actual shipping weight when an item should be priced by weight, such as a very heavy book that could cost more to ship than the standard item-count rate.

1. Open the catalog item.
2. Enter the item’s weight in pounds.
3. Use a value greater than `0.1`.
4. Save the item.

Weight-based shipping is calculated at:

**$2 per pound**

The system adds together the weights of all eligible weight-based items, multiplies the total by $2, and rounds the result up to the nearest cent before applying the minimum rules below.

## Weight-based minimums

After multiplying the total weight by $2:

| Calculated amount | Final shipping price |
| ----------------: | -------------------: |
|      Less than $1 |        Free shipping |
|     $1 through $5 |                   $5 |
|      More than $5 |    Calculated amount |

### Examples

A 2-pound item produces a calculated charge of $4. Because that amount is between $1 and $5, the final shipping charge is $5.

A 5-pound item produces a calculated charge of $10. The final shipping charge is $10.

A 3.1-pound item produces a calculated charge of $6.20. Because that amount is more than $5, the final shipping charge is $6.20.

An eligible item or group of items producing a calculated charge below $1 receives free shipping.

# Recipe 3: Postcards and free-shipping items

Use a shipping weight of `0.1` pounds or less for postcards or other items that should always ship free.

1. Open the catalog item.
2. Enter `0.1` in the **Shipping Weight** field.
3. Save the item.

These items:

* Receive free shipping.
* Are not included in the total shipping weight.
* Are not included in the item-count shipping calculation.
* Do not increase the shipping price of a mixed order.

The Shipping Weight field is used because there is no separate free-shipping setting available through the catalog API.

# Recipe 4: Orders containing mixed item types

A mixed order contains both:

* Items with a blank Shipping Weight.
* Items with a Shipping Weight greater than `0.1` pounds.

For these orders, the system calculates two shipping quotes.

## Quote 1: Item-count shipping

Count every qualifying item in the order, including:

* Items with a blank Shipping Weight.
* Items with a Shipping Weight greater than `0.1` pounds.

Do not count items with a Shipping Weight of `0.1` pounds or less.

Use the item-count rate table to calculate the quote.

## Quote 2: Weight-based shipping

Add the weights of items with a Shipping Weight greater than `0.1` pounds.

Multiply the total by $2 per pound and apply the weight-based minimum rules.

Items with a blank Shipping Weight are not included in the weight total. Items weighing `0.1` pounds or less are also excluded.

## Select the final price

Compare the two quotes and charge whichever amount is higher.

**Final shipping price = higher of the item-count quote or the weight-based quote**

# Mixed-order example

An order contains three products:

| Product       | Shipping Weight | Shipping treatment                 |
| ------------- | --------------: | ---------------------------------- |
| Standard book |           Blank | Included in item-count quote       |
| Heavy book    |        5 pounds | Included in both quotes            |
| Postcard      |      0.1 pounds | Free and excluded from both quotes |

### Item-count quote

There are two qualifying items: the standard book and the heavy book.

The rate for two items is **$6**.

### Weight-based quote

Only the 5-pound book is included in the weight total.

**5 pounds × $2 = $10**

### Final shipping price

The system compares $6 and $10.

Because $10 is higher, the customer is charged **$10 for shipping**.

# Quick reference

| Desired result                    |                  Shipping Weight value |
| --------------------------------- | -------------------------------------: |
| Use normal book shipping          |                            Leave blank |
| Charge according to actual weight | Enter weight greater than `0.1` pounds |
| Give the item free shipping       |             Enter `0.1` pounds or less |

Before saving an item, verify that the Shipping Weight field matches the intended shipping behavior. Accidentally entering `0` or `0.1` for a standard book will cause that book to ship free.
