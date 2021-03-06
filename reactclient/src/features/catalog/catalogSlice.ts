import { createAsyncThunk, createEntityAdapter, createSlice } from "@reduxjs/toolkit";
import agent from "../../app/api/agent";
import { MetaData } from "../../app/models/pagination";
import { Product, ProductParams } from "../../app/models/product";
import { RootState } from "../../app/store/configureStore";

interface CatalogState {
	productsLoaded: boolean;
	filtersLoaded: boolean;
	status: string;
	brands: string[];
	types: string[];
	productParams: ProductParams;
	metaData: MetaData | null;
}

const productsAdapter = createEntityAdapter<Product>();

function getAxiosParams(productParams: ProductParams) {
	const params = new URLSearchParams();
	params.append("pageNumber", productParams.pageNumber.toString());
	params.append("pageSize", productParams.pageSize.toString());
	params.append("orderBy", productParams.orderBy);
	if (productParams.searchTerm) params.append("searchTerm", productParams.searchTerm);
	if (productParams.brands.length > 0)
		params.append("brands", productParams.brands.toString());
	if (productParams.types.length > 0)
		params.append("types", productParams.types.toString());
	return params;
}

export const fetchProductsAsync = createAsyncThunk<
	Product[],
	void,
	{ state: RootState }
>("catalog/fetchProductsAsync", async (_, thunkAPI) => {
	const params = getAxiosParams(thunkAPI.getState().catalog.productParams);
	try {
		const response = await agent.Catalog.list(params);
		thunkAPI.dispatch(setMetaData(response.metaData));
		return response.items;
	} catch (error: any) {
		console.log("fetchProductsAsync", error);
		return thunkAPI.rejectWithValue({ error: error.data });
	}
});

export const fetchProductAsync = createAsyncThunk<Product, number>(
	"catalog/fetchProductAsync",
	async (productId, thunkAPI) => {
		try {
			return await agent.Catalog.details(productId);
		} catch (error: any) {
			console.log("fetchProduct-Async", error);
			return thunkAPI.rejectWithValue({ error: error.data });
		}
	}
);

export const fetchFilters = createAsyncThunk(
	"catalog/fetchFilters",
	async (_, thunkAPI) => {
		try {
			return agent.Catalog.fetchFilters();
		} catch (error: any) {
			console.log("fetchFilters", error);
			return thunkAPI.rejectWithValue({ error: error.data });
		}
	}
);

function initParams() {
	return {
		pageNumber: 1,
		pageSize: 6,
		orderBy: "name",
		brands: [],
		types: [],
	};
}

export const catalogSlice = createSlice({
	name: "catalog",
	initialState: productsAdapter.getInitialState<CatalogState>({
		productsLoaded: false,
		filtersLoaded: false,
		status: "idle",
		brands: [],
		types: [],
		productParams: initParams(),
		metaData: null,
	}),

	reducers: {
		setProductParams: (state, action) => {
			state.productsLoaded = false;
			state.productParams = {
				...state.productParams,
				...action.payload,
				pageNumber: 1,
			};
		},
		setPageNumber: (state, action) => {
			state.productsLoaded = false;
			state.productParams = { ...state.productParams, ...action.payload };
		},
		setMetaData: (state, action) => {
			state.metaData = action.payload;
		},
		resetProductParams: (state) => {
			state.productParams = initParams();
		},
		setProduct: (state, action) => {
			productsAdapter.upsertOne(state, action.payload);
			state.productsLoaded = false;
			// * note below
		},
		removeProduct: (state, action) => {
			productsAdapter.removeOne(state, action.payload);
			state.productsLoaded = false;
			// * note below
		},
	},

	extraReducers: (builder) => {
		builder.addCase(fetchProductsAsync.pending, (state) => {
			state.status = "pendingFetchProductsAsync";
		});
		builder.addCase(fetchProductsAsync.fulfilled, (state, action) => {
			productsAdapter.setAll(state, action.payload);
			state.status = "idle";
			state.productsLoaded = true;
		});
		builder.addCase(fetchProductsAsync.rejected, (state, action) => {
			console.log(action.payload);
			state.status = "idle";
		});
		builder.addCase(fetchProductAsync.pending, (state) => {
			state.status = "pendingFetchProductAsync";
		});
		builder.addCase(fetchProductAsync.fulfilled, (state, action) => {
			productsAdapter.upsertOne(state, action.payload);
			state.status = "idle";
		});
		builder.addCase(fetchProductAsync.rejected, (state, action) => {
			console.log(action);
			state.status = "idle";
		});
		builder.addCase(fetchFilters.pending, (state) => {
			state.status = "pendingFetchFilters";
		});
		builder.addCase(fetchFilters.fulfilled, (state, action) => {
			state.brands = action.payload.brands;
			state.types = action.payload.types;
			state.filtersLoaded = true;
			state.status = "idle";
		});
		builder.addCase(fetchFilters.rejected, (state, action) => {
			console.log(action.payload);
			state.status = "idle";
		});
	},
});

export const productSelectors = productsAdapter.getSelectors(
	(state: RootState) => state.catalog
);

export const {
	setProductParams,
	resetProductParams,
	setMetaData,
	setPageNumber,
	setProduct,
	removeProduct,
} = catalogSlice.actions;

/* Notes:

setProduct and removeProduct:

- code line A mades B obsolete and unnecessary
- code line A needed to keep pagination correctly rendering 

	B:  productsAdapter.upsertOne(state, action.payload);
	A:  state.productsLoaded = false; 
			
	B:  productsAdapter.removeOne(state, action.payload);
	A:  state.productsLoaded = false; 

- A (setting state to false) triggers useEffect in useProducts hook, forcing rerender...
- is there another way to update pagination within Redux / client state without Db call?
	
*/
