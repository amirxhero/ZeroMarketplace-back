import Controllers                from '../core/Controllers.js';
import InventoriesModel           from "../models/InventoriesModel.js";
import persianDate                from 'persian-date';
import {ObjectId}                 from 'mongodb';
import InventoryChangesController from "./InventoryChangesController.js";
import CommodityProfitsController from "./CommodityProfitsController.js";
import InputsController           from "./InputsController.js";
import PurchaseInvoices           from "../routes/purchase-invoices.js";
import PurchaseInvoicesController from "./PurchaseInvoicesController.js";
import SalesInvoicesController    from "./SalesInvoicesController.js";
import SettingsController         from "./SettingsController.js";
import StockTransfersController   from "./StockTransfersController.js";
import purchaseInvoices           from "../routes/purchase-invoices.js";

class InventoriesController extends Controllers {
    static model = new InventoriesModel();

    constructor() {
        super();
    }

    static getProductPriceByLifoMethod($input) {
        return new Promise(async (resolve, reject) => {
            try {

                // get the latest inventory of product
                await this.model.item(
                    {
                        _product: $input._id,
                        count   : {$gt: 0}
                    },
                    {
                        sort  : {dateTime: -1},
                        select: '_id price'
                    }
                ).then(
                    (response) => {
                        return resolve({
                            consumer: response.price.consumer,
                            store   : response.price.store,
                        });
                    },
                    (error) => {
                        if (error.code && error.code === 404) {
                            // price not founded is 0
                            return resolve({
                                consumer: 0,
                                store   : 0
                            });
                        } else {
                            return reject(error);
                        }
                    }
                );

            } catch (error) {
                return reject(error);
            }
        });
    }

    static getProductPriceByFifoMethod($input) {
        return new Promise(async (resolve, reject) => {
            try {

                // get the latest inventory of product
                await this.model.item(
                    {
                        _product: $input._id,
                        count   : {$gt: 0}
                    },
                    {
                        sort  : {dateTime: 1},
                        select: '_id price'
                    }
                ).then(
                    (response) => {
                        return resolve({
                            consumer: response.price.consumer,
                            store   : response.price.store,
                        });
                    },
                    (error) => {
                        if (error.code && error.code === 404) {
                            // price not founded is 0
                            return resolve({
                                consumer: 0,
                                store   : 0
                            });
                        } else {
                            return reject(error);
                        }
                    }
                );

            } catch (error) {
                return reject(error);
            }
        });
    }

    static getProductPriceByMaxMethod($input) {
        return new Promise(async (resolve, reject) => {
            try {

                // get the highest purchase price inventory of product
                await this.model.item(
                    {
                        _product: $input._id,
                        count   : {$gt: 0}
                    },
                    {
                        sort  : {'price.purchase': -1},
                        select: '_id price'
                    }
                ).then(
                    (response) => {
                        return resolve({
                            consumer: response.price.consumer,
                            store   : response.price.store,
                        });
                    },
                    (error) => {
                        if (error.code && error.code === 404) {
                            // price not founded is 0
                            return resolve({
                                consumer: 0,
                                store   : 0
                            });
                        } else {
                            return reject(error);
                        }
                    }
                );

            } catch (error) {
                return reject(error);
            }
        });
    }

    static getProductPriceByWeightedAverageMethod($input) {
        return new Promise(async (resolve, reject) => {
            try {

                // get the highest purchase price inventory of product
                let inventories = await this.model.list(
                    {_product: $input._id},
                    {select: '_id price count', sort: {dateTime: -1}}
                );

                let sumOfCounts = 0;
                let sumOfPrice  = 0;

                inventories.forEach(inventory => {
                    sumOfPrice += (inventory.count * inventory.price.consumer);
                    sumOfCounts += inventory.count;
                });


                if (sumOfCounts > 0) {
                    let price = Math.ceil((sumOfPrice / sumOfCounts));
                    return resolve({
                        consumer: price,
                        store   : price
                    })
                } else {
                    return resolve({
                        consumer: 0,
                        store   : 0
                    })
                }

            } catch (error) {
                return reject(error);
            }
        });
    }

    static getProductPrice($input) {
        return new Promise(async (resolve, reject) => {
            try {

                // get pricing method
                let pricingMethod = await SettingsController.get({
                    key: 'pricingMethod'
                });

                let price = undefined;

                // switch for pricing method value
                switch (pricingMethod.data.value) {
                    case 'lifo':
                        price = await this.getProductPriceByLifoMethod($input);
                        break;
                    case 'fifo':
                        price = await this.getProductPriceByFifoMethod($input);
                        break;
                    case 'max':
                        price = await this.getProductPriceByMaxMethod($input);
                        break;
                    case 'weightedAverage':
                        price = await this.getProductPriceByWeightedAverageMethod($input);
                        break;
                }

                return resolve({
                    code: 200,
                    data: price
                });
            } catch (error) {
                return reject(error);
            }
        })
    }

    static async outputBuilder($row) {
        for (const [$index, $value] of Object.entries($row)) {
            switch ($index) {
                case 'dateTime':
                    let dateTimeJalali      = new persianDate($value);
                    $row[$index + 'Jalali'] = dateTimeJalali.toLocale('fa').format();
                    break;
                case 'updatedAt':
                    let updatedAtJalali     = new persianDate($value);
                    $row[$index + 'Jalali'] = updatedAtJalali.toLocale('fa').format();
                    break;
                case 'createdAt':
                    let createdAtJalali     = new persianDate($value);
                    $row[$index + 'Jalali'] = createdAtJalali.toLocale('fa').format();
                    break;
                case 'productDetails':
                    // check if is variant of original product
                    if ($row['product'].toString() !== $value._id.toString()) {
                        let variant  = $value.variants.find(variant => variant._id.toString() === $row['product'].toString());
                        $value.title = variant.title;
                    }

                    // delete variants from output
                    $value['variants'] = undefined;

                    break;
            }
        }

        return $row;
    }

    static queryBuilder($input) {
        let $query = {};

        // pagination and sort
        this.detectPaginationAndSort($input);


        for (const [$index, $value] of Object.entries($input)) {
            switch ($index) {
                case '_warehouse':
                    $query._warehouse = $value;
                    break;
            }
        }

        return $query;
    }

    static insertOne($input) {
        return new Promise(async (resolve, reject) => {
            try {
                // validate input
                await InputsController.validateInput($input, {
                    dateTime        : {type: 'date', required: true},
                    _product        : {type: 'mongoId', required: true},
                    count           : {type: 'number', required: true},
                    _warehouse      : {type: 'mongoId', required: true},
                    _purchaseInvoice: {type: 'mongoId', required: true},
                    price           : {
                        type      : 'object',
                        properties: {
                            purchase: {type: 'number', required: true},
                            consumer: {type: 'number', required: true},
                            store   : {type: 'number', required: true}
                        }
                    }
                });

                // insert to db
                let response = await this.model.insertOne({
                    dateTime        : $input.dateTime,
                    _product        : $input._product,
                    count           : $input.count,
                    _warehouse      : $input._warehouse,
                    _purchaseInvoice: $input._purchaseInvoice,
                    price           : $input.price,
                    status          : 'active',
                    _user           : $input.user.data._id
                });

                // create output
                response = await this.outputBuilder(response.toObject());

                // return result
                return resolve({
                    code: 200,
                    data: response
                });
            } catch (error) {
                return reject(error);
            }
        });
    }

    // insert inventories when purchase invoice inserted (Increase the inventory of products)
    static insertByPurchaseInvoice($input) {
        return new Promise(async (resolve, reject) => {
            try {

                // get purchase invoice
                if (!$input.purchaseInvoice) {
                    // get invoice from its Controller
                    $input.purchaseInvoice = await PurchaseInvoicesController.get(
                        {_id: $input._id},
                        {select: '_id products'},
                        'model'
                    );
                    // get the data of purchase invoice
                    $input.purchaseInvoice = $input.purchaseInvoice.data;
                }

                // init inserted inventories list
                let inventories = [];

                // for each product in invoice
                for (const product of $input.purchaseInvoice.products) {
                    // insert an inventory for product
                    let response = await this.insertOne({
                        dateTime        : $input.purchaseInvoice.dateTime,
                        _product        : product._id,
                        count           : product.count,
                        _warehouse      : $input.purchaseInvoice._warehouse,
                        _purchaseInvoice: $input.purchaseInvoice._id,
                        price           : {
                            purchase: product.price.purchase,
                            consumer: product.price.consumer,
                            store   : product.price.store
                        },
                        user            : $input.user
                    });

                    // add to inserted inventories
                    inventories.push(response.data);
                }

                // change purchase-invoice status to Complete
                $input.purchaseInvoice.status = 'Completed';
                await $input.purchaseInvoice.save();

                // return result of insert inventories
                return resolve({
                    code: 200,
                    data: inventories
                });

            } catch (error) {
                return reject(error);
            }
        });
    }

    static inventories($input) {
        return new Promise(async (resolve, reject) => {
            try {
                // validate Input
                await InputsController.validateInput($input, {
                    perPage      : {type: "number"},
                    page         : {type: "number"},
                    sortColumn   : {type: "string"},
                    sortDirection: {type: "number"},
                });

                // check filter is valid and remove other parameters (just valid query by user role) ...
                let $query = this.queryBuilder($input);

                // exec the query
                let response = await this.model.inventories(
                    $query,
                    {
                        skip : $input.offset,
                        limit: $input.perPage,
                        sort : $input.sort
                    }
                );

                // create output
                for (const row of response.list) {
                    const index          = response.list.indexOf(row);
                    response.list[index] = await this.outputBuilder(row);
                }

                // return result
                return resolve({
                    code: 200,
                    data: {
                        list : response.list,
                        total: response.count
                    }
                });

            } catch (error) {
                return reject(error);
            }
        });
    }

    static getInventoryOfProduct($input) {
        return new Promise(async (resolve, reject) => {
            try {
                // validate Input
                await InputsController.validateInput($input, {
                    _id        : {type: 'mongoId', required: true},
                    typeOfSales: {
                        type         : 'string',
                        allowedValues: ['retail', 'onlineSales']
                    }
                });

                let response = await this.model.getInventoryOfProduct($input);

                return resolve({
                    code: 200,
                    data: response
                });
            } catch (error) {
                return reject(error);
            }
        });
    }

    // update inventories info when purchase invoice updated
    static updateByPurchaseInvoice($input) {
        return new Promise(async (resolve, reject) => {
            try {
                // get purchase invoice
                if (!$input.purchaseInvoice) {
                    // get invoice from its Controller
                    $input.purchaseInvoice = await PurchaseInvoicesController.get(
                        {_id: $input._id},
                        {select: '_id products'}
                    );
                    // get the data of purchase invoice
                    $input.purchaseInvoice = $input.purchaseInvoice.data;
                }


                // get inventories created by this purchase invoice
                let inventories = await this.model.list({
                    _purchaseInvoice: $input._id,
                });

                // products of purchase invoice
                let lastProducts = $input.purchaseInvoice.products;
                // new products
                let newProducts  = structuredClone($input.products);

                // for each inventory
                for (let inventory of inventories) {
                    // find product in purchase invoice new products
                    let product = newProducts.find(
                        i => i._id === inventory._product.toString()
                    );

                    // check exist
                    if (product) {
                        // update the inventory information
                        // set price
                        inventory.price = product.price;
                        // set the count
                        // find the last count in purchase invoice
                        let lastProductInfo = lastProducts.find(
                            i => i._id.toString() === inventory._product.toString()
                        );
                        // minus the last count
                        inventory.count -= lastProductInfo.count;
                        // add new count to inventory
                        inventory.count += product.count;

                        // set the new warehouse
                        inventory._warehouse = $input._warehouse

                        // set the new dateTime
                        inventory.dateTime = $input.dateTime

                        // save the inventory info
                        await inventory.save();


                        // delete the product from input product
                        newProducts.splice(
                            newProducts.indexOf(product),
                            1
                        );

                    } else {
                        // delete inventory because the product was deleted from updated info of invoice
                        await inventory.deleteOne();
                    }
                }

                // add inventory of new products
                for (const product of newProducts) {
                    await this.insertOne({
                        dateTime        : $input.dateTime,
                        _product        : product._id,
                        count           : product.count,
                        _warehouse      : $input._warehouse,
                        _purchaseInvoice: $input._id,
                        price           : {
                            purchase: product.price.purchase,
                            consumer: product.price.consumer,
                            store   : product.price.store
                        },
                        _user           : $input.user
                    });
                }

                return resolve({
                    code: 200
                });

            } catch (error) {
                return reject(error);
            }
        })
    }

    static updateByStockTransfer($input) {
        return new Promise(async (resolve, reject) => {
            try {

                // get stock transfer
                if (!$input.stockTransfer) {
                    // get the stock transfer from its Controller
                    $input.stockTransfer = await StockTransfersController.get(
                        {_id: $input._id},
                        {select: '_id'}
                    );
                    // get the data of stock transfer
                    $input.stockTransfer = $input.stockTransfer.data;
                }

                // get the list of product in source warehouse
                let inventories = await this.model.list(
                    {
                        _warehouse: $input._sourceWarehouse,
                        _product  : $input._product,
                        count     : {$gt: 0}
                    },
                    {
                        sort: {
                            count: 1
                        }
                    }
                );

                // init the remaining counter and change logger
                let remainingCount = $input.count;
                let changes        = [];

                // change or add new inventory
                for (const inventory of inventories) {
                    // check all the products transferred
                    if (remainingCount < 1) {
                        break;
                    }

                    if (remainingCount >= inventory.count) {
                        // add to changes
                        changes.push({
                            operation : 'update',
                            field     : '_warehouse',
                            oldValue  : inventory._warehouse,
                            newValue  : new ObjectId($input._destinationWarehouse),
                            _inventory: inventory._id
                        });

                        // change the _warehouse
                        inventory._warehouse = $input._destinationWarehouse;
                        await inventory.save();

                        remainingCount -= inventory.count;
                    } else {
                        // add to changes
                        changes.push({
                            operation : 'update',
                            field     : 'count',
                            oldValue  : inventory.count,
                            newValue  : (inventory.count - remainingCount),
                            _inventory: inventory._id
                        });

                        // minus count of inventory
                        inventory.count -= remainingCount;
                        await inventory.save();

                        let productPrice = await this.getProductPrice({
                            _id: $input._id
                        });

                        // add new inventory of remaining count
                        let newInventory = await this.insertOne({
                            dateTime        : new Date(),
                            count           : remainingCount,
                            _product        : $input._product,
                            _warehouse      : $input._destinationWarehouse,
                            _purchaseInvoice: inventory._purchaseInvoice,
                            price           : {
                                purchase: inventory.price.purchase,
                                consumer: productPrice.data.consumer,
                                store   : productPrice.data.store,
                            },
                            status          : 'active',
                            user            : $input.user
                        });

                        // add to changes (insert)
                        changes.push({
                            operation : 'insert',
                            _inventory: newInventory.data._id
                        });

                        remainingCount = 0;
                    }
                }

                // add changes to inventoryChanges
                let inventoryChangesResponse = await InventoryChangesController.insertOne({
                    type      : 'stock-transfer',
                    changes   : changes,
                    _reference: $input._id
                });

                return resolve({
                    code: 200,
                    data: {
                        _inventoryChanges: inventoryChangesResponse.data._id
                    }
                });
            } catch (error) {
                return reject(error);
            }
        })
    }

    static returnUpdatesByInventoryChanges($input) {
        return new Promise(async (resolve, reject) => {
            try {
                // get inventory Changes
                if (!$input.inventoryChanges) {
                    // get inventory Changes from its Controller
                    $input.inventoryChanges = await InventoryChangesController.get(
                        {_id: $input._id},
                        {select: '_id changes'}
                    );
                    // get the data of inventory Changes
                    $input.inventoryChanges = $input.inventoryChanges.data;
                }

                // get the ids of inventories
                let inventories = await this.model.list({
                    _id: {$in: $input.inventoryChanges.changes.map(i => i._inventory)}
                });


                // for each change
                for (const change of $input.inventoryChanges.changes) {
                    // get the related inventory
                    let inventory = inventories.find(i => i._id.toString() === change._inventory.toString());
                    // switch the change operation
                    switch (change.operation) {
                        case 'update':
                            // check the count changes (exception)
                            if (change.field === 'count') {
                                inventory.count -= change.newValue;
                                inventory.count += change.oldValue;
                            } else {
                                // update the inventory and set the old value to related field
                                inventory[change.field] = change.oldValue;
                            }
                            await inventory.save();
                            break
                        case 'insert':
                            // delete the new inventory
                            inventory.deleteOne();
                            break;
                    }
                }

                // return result
                return resolve({
                    code: 200
                });

            } catch (error) {
                return reject(error);
            }
        })
    }

    static stockSales($input) {
        return new Promise(async (resolve, reject) => {
            try {
                // create query
                let query = {
                    _product: $input._product
                };

                // get inventory of product
                let inventoryOfProduct = await this.getInventoryOfProduct(
                    {
                        _id        : $input._product,
                        typeOfSales: $input.typeOfSales
                    },
                );

                // check total count of inventory
                if ($input.count > inventoryOfProduct.data.total) {
                    return reject({
                        code: 400,
                        data: {
                            message : 'The number of products available for sale is less than the count you requested.',
                            _product: $input._product
                        }
                    });
                }

                // check warehouse count
                if ($input._warehouse) {
                    // add _warehouse to query
                    query._warehouse = $input._warehouse;


                    // Get the number of selected warehouse inventories items for sale
                    let warehouseCount = inventoryOfProduct.data.warehouses.find(
                        warehouse => warehouse._id.toString() === $input._warehouse.toString()
                    );

                    // check the count of source warehouse
                    if (
                        !warehouseCount ||
                        (warehouseCount && warehouseCount.count < $input.count)
                    ) {
                        return reject({
                            code: 400,
                            data: {
                                message: 'The inventory is less than your input'
                            }
                        });
                    }
                }

                // minus inventory count
                // init the inventory changes variable
                let inventoryChanges = [];

                // exception for counting on inventories
                query.count = {$gt: 0};

                // get the inventories from db and sorted by dateTime (old one is first)
                let inventories = await this.model.list(query, {
                    sort: {dateTime: 1}
                });

                let remainingCount = $input.count;

                // minus remaining count from inventories
                for (const inventory of inventories) {
                    // The check of the remaining count is not finished
                    if (remainingCount > 0) {
                        if (remainingCount >= inventory.count) {

                            // add to changes
                            inventoryChanges.push({
                                operation : 'update',
                                field     : 'count',
                                oldValue  : inventory.count,
                                newValue  : 0,
                                _inventory: inventory._id
                            });

                            // add commodity profit
                            let commodityProfit = await CommodityProfitsController.insertOne({
                                typeOfSales: $input.typeOfSales,
                                _reference : $input._reference,
                                _inventory : inventory._id,
                                price      : $input.price,
                                count      : inventory.count
                            });

                            // minus inventory count
                            inventory.count -= inventory.count;
                            // save the inventory
                            await inventory.save();

                            // minus the remaining count
                            remainingCount -= inventory.count;

                        } else {

                            // add to changes
                            inventoryChanges.push({
                                operation : 'update',
                                field     : 'count',
                                oldValue  : inventory.count,
                                newValue  : (inventory.count - remainingCount),
                                _inventory: inventory._id
                            });

                            // add commodity profit
                            let commodityProfit = await CommodityProfitsController.insertOne({
                                typeOfSales: $input.typeOfSales,
                                _reference : $input._reference,
                                _inventory : inventory._id,
                                price      : $input.price,
                                count      : remainingCount
                            });

                            // minus inventory count
                            inventory.count -= remainingCount;
                            // save the inventory
                            await inventory.save();

                            // minus remaining count
                            remainingCount -= remainingCount;
                        }
                    } else {
                        break;
                    }
                }

                // add changes to inventoryChanges
                let inventoryChangesInsertion = await InventoryChangesController.insertOne({
                    type      : 'stock-sales',
                    changes   : inventoryChanges,
                    _reference: $input._reference
                });

                // return the inventory changes
                return resolve({
                    code: 200,
                    data: {
                        _inventoryChanges: inventoryChangesInsertion.data._id
                    }
                });
            } catch (error) {
                return reject(error);
            }
        })
    }

    static stockSalesBySalesInvoice($input) {
        return new Promise(async (resolve, reject) => {
            try {

                // get sales invoice if not passed
                if (!$input.salesInvoice) {
                    $input.salesInvoice = await SalesInvoicesController.get(
                        {_id: $input._id},
                        {select: 'products'},
                        'model'
                    );
                    $input.salesInvoice = $input.salesInvoice.data;
                }


                // change inventory counts
                for (const product of $input.salesInvoice.products) {
                    // update counts
                    let response = await this.stockSales({
                        _product   : product._id,
                        _warehouse : product._warehouse,
                        count      : product.count,
                        price      : product.price,
                        _reference : $input._id,
                        typeOfSales: 'retail'
                    });

                    // set the _inventoryChanges
                    product._inventoryChanges = response.data._inventoryChanges;
                }

                // update the sales invoice
                await $input.salesInvoice.save();

                return resolve({
                    code: 200
                });
            } catch (error) {
                return reject(error);
            }
        });
    }

    static deleteByPurchaseInvoice($input) {
        return new Promise(async (resolve, reject) => {
            try {
                // delete all inventories created by purchase-invoice
                let response = await this.model.delete({
                    _purchaseInvoice: $input._id
                });

                // check the deleted count
                if (response.deletedCount) {
                    return resolve({
                        code: 200
                    });
                } else {
                    return reject({
                        code: 500,
                        data: {
                            message: 'Error Deleting Inventories of purchase invoice'
                        }
                    });
                }
            } catch (error) {
                return reject(error);
            }
        })
    }

}

export default InventoriesController;
