import Models   from '../core/Models.js';
import {Schema} from 'mongoose';

class StockTransfersModel extends Models {

    // const Account = null;
    static schema = new Schema({
            _sourceWarehouse     : {type: Schema.Types.ObjectId, ref: 'warehouses'},
            _destinationWarehouse: {type: Schema.Types.ObjectId, ref: 'warehouses'},
            _product             : {type: Schema.Types.ObjectId, ref: 'products'},
            count                : Number,
            _inventoryChanges    : {type: Schema.Types.ObjectId, ref: 'inventory-changes'},
            status               : {
                type: String,
                enum: [
                    'Draft',
                    'Pending Approval',
                    'Approved',
                    'Dispatched',
                    'In Transit',
                    'Received',
                    'Completed',
                    'Cancelled',
                ]
            },
            _user                : {type: Schema.Types.ObjectId, ref: 'users'}
        },
        {timestamps: true});

    constructor() {
        super('stock-transfers', StockTransfersModel.schema);
    }

    transfers($filter, $options) {
        return new Promise(async (resolve, reject) => {
            try {
                const aggregationQuery = [
                    {
                        $match: $filter
                    },
                    {
                        $sort: $options.sort
                    },
                    {
                        $skip: $options.skip
                    },
                    {
                        $limit: $options.limit
                    },
                    {
                        $project: {
                            _id                  : 1,
                            _sourceWarehouse     : 1,
                            _destinationWarehouse: 1,
                            _product             : 1,
                            count                : 1,
                            updatedAt            : 1,
                            createdAt            : 1,
                            status               : 1,
                        }
                    },
                    {
                        $lookup: {
                            from    : 'products',
                            let     : {productId: '$_product'},
                            pipeline: [
                                {
                                    $match: {
                                        $expr: {
                                            $or: [
                                                {$eq: ['$_id', '$$productId']},
                                                {$in: ['$$productId', '$variants._id']}
                                            ]
                                        }
                                    }
                                },
                                {
                                    $project: {
                                        _id     : 1,
                                        title   : 1,
                                        variants: 1,
                                        code    : 1,
                                        _unit   : 1
                                    }
                                }
                            ],
                            as      : 'productDetails'
                        },

                    },
                    {
                        $unwind: '$productDetails'
                    },
                    {
                        $lookup: {
                            from        : 'units',
                            localField  : 'productDetails._unit',
                            foreignField: '_id',
                            as          : 'productDetails._unitDetails'
                        }
                    },
                    {
                        $unwind: {
                            path                      : '$productDetails._unitDetails',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $addFields: {
                            'productDetails._unit': {
                                _id  : '$productDetails._unitDetails._id',
                                title: '$productDetails._unitDetails.title'
                            }
                        }
                    },
                    {
                        $project: {
                            'productDetails._unitDetails': 0
                        }
                    },
                    {
                        $lookup: {
                            from        : 'warehouses',
                            localField  : '_sourceWarehouse',
                            foreignField: '_id',
                            as          : '_sourceWarehouse'
                        }
                    },
                    {
                        $unwind: {
                            path                      : '$_sourceWarehouse',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $addFields: {
                            '_sourceWarehouse': {
                                _id  : '$_sourceWarehouse._id',
                                title: '$_sourceWarehouse.title'
                            }
                        }
                    },
                    {
                        $lookup: {
                            from        : 'warehouses',
                            localField  : '_destinationWarehouse',
                            foreignField: '_id',
                            as          : '_destinationWarehouse'
                        }
                    },
                    {
                        $unwind: {
                            path                      : '$_destinationWarehouse',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    {
                        $addFields: {
                            '_destinationWarehouse': {
                                _id  : '$_destinationWarehouse._id',
                                title: '$_destinationWarehouse.title'
                            }
                        }
                    },
                    {
                        $project: {
                            _id                          : 1,
                            '_sourceWarehouse.title'     : 1,
                            '_sourceWarehouse._id'       : 1,
                            '_destinationWarehouse.title': 1,
                            '_destinationWarehouse._id'  : 1,
                            count                        : 1,
                            productDetails               : 1,
                            _product                     : 1,
                            updatedAt                    : 1,
                            createdAt                    : 1,
                            status                       : 1
                        }
                    }
                ];

                // exec the aggregation
                let response = await this.collectionModel.aggregate(aggregationQuery);

                // return resolve
                return resolve(response);
            } catch (error) {
                return reject(error);
            }
        });
    }

}

export default StockTransfersModel;
