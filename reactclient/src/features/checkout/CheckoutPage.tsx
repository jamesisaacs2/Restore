import { Box, Button, Paper, Step, StepLabel, Stepper, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { FieldValues, FormProvider, useForm } from "react-hook-form";
import AddressForm from "./AddressForm";
import PaymentForm from "./PaymentForm";
import Review from "./Review";
import { yupResolver } from "@hookform/resolvers/yup";
import { validationSchema } from "./checkoutValidation";
import agent from "../../app/api/agent";
import { useAppDispatch, useAppSelector } from "../../app/store/configureStore";
import { clearBasket } from "../basket/basketSlice";
import { LoadingButton } from "@mui/lab";
import { StripeElementType } from "@stripe/stripe-js";
import { CardNumberElement, useElements, useStripe } from "@stripe/react-stripe-js";

const steps = ["Shipping address", "Review your order", "Payment details"];

export default function CheckoutPage() {
	const [activeStep, setActiveStep] = useState(0);
	const [orderNumber, setOrderNumber] = useState(0);
	const [loading, setLoading] = useState(false);
	const dispatch = useAppDispatch();
	const [cardState, setCardState] = useState<{
		elementError: { [key in StripeElementType]?: string };
	}>({ elementError: {} });
	const [cardComplete, setCardComplete] = useState<any>({
		cardNumber: false,
		cardExpiry: false,
		cardCvc: false,
	});
	const [paymentMessage, setPaymentMessage] = useState("");
	const [paymentSuccess, setPaymentSuccess] = useState(false);
	const { basket } = useAppSelector((state) => state.basket);
	const stripe = useStripe();
	const elements = useElements();

	function onCardInputChange(event: any) {
		setCardState({
			...cardState,
			elementError: {
				...cardState.elementError,
				[event.elementType]: event.error?.message,
			},
		});
	}

	function getStepContent(step: number) {
		switch (step) {
			case 0:
				return <AddressForm />;
			case 1:
				return <Review />;
			case 2:
				return <PaymentForm cardState={cardState} onCardInputChange={onCardInputChange} />;
			default:
				throw new Error("Unknown step");
		}
	}

	const currentValidationSchema = validationSchema[activeStep];

	const methods = useForm({
		mode: "all",
		resolver: yupResolver(currentValidationSchema),
	});

	useEffect(() => {
		agent.Account.fetchAddress().then((response) => {
			if (response) {
				methods.reset({ ...methods.getValues(), ...response, saveAddress: false });
			}
		});
	}, [methods]);

	async function submitOrder(data: FieldValues) {
		setLoading(true);
		const { nameOnCard, saveAddress, ...shippingAddress } = data;
		if (!stripe || !elements) return; //stripe is not yet ready
		try {
			const cardElement = elements.getElement(CardNumberElement);
			const paymentResult = await stripe.confirmCardPayment(basket?.clientSecret!, {
				payment_method: {
					card: cardElement!,
					billing_details: {
						name: nameOnCard,
					},
				},
			});
			console.log("paymentResult: ", paymentResult);
			if (paymentResult.paymentIntent?.status == "succeeded") {
				const orderNumber = await agent.Orders.create({ saveAddress, shippingAddress });
				setOrderNumber(orderNumber);
				setPaymentSuccess(true);
				setPaymentMessage("We have received payment - Thank you!");
				setActiveStep(activeStep + 1);
				dispatch(clearBasket());
				setLoading(false);
			} else {
				setPaymentMessage(paymentResult.error?.message!);
				setPaymentSuccess(false);
				setLoading(false);
				setActiveStep(activeStep + 1);
			}
		} catch (error) {
			console.log("submitOrder: ", error);
			setLoading(false);
		}
	}

	const handleNext = async (data: FieldValues) => {
		if (activeStep === steps.length - 1) {
			await submitOrder(data);
		} else {
			setActiveStep(activeStep + 1);
		}
	};

	const handleBack = () => {
		setActiveStep(activeStep - 1);
	};

	function submitDisabled(): boolean {
		if (activeStep === steps.length - 1) {
			return (
				!cardComplete.cardCvc ||
				!cardComplete.cardExpiry ||
				!cardComplete.cardNumber ||
				!methods.formState.isValid
			);
		} else {
			return !methods.formState.isValid;
		}
	}

	return (
		<FormProvider {...methods}>
			<Paper variant="outlined" sx={{ my: { xs: 3, md: 6 }, p: { xs: 2, md: 3 } }}>
				<Typography component="h1" variant="h4" align="center">
					Checkout
				</Typography>
				<Stepper activeStep={activeStep} sx={{ pt: 3, pb: 4 }}>
					{steps.map((label) => (
						<Step key={label}>
							<StepLabel>{label}</StepLabel>
						</Step>
					))}
				</Stepper>
				<>
					{activeStep === steps.length ? (
						<>
							<Box m={3}>
								<Typography variant="h5" gutterBottom>
									{paymentMessage}
								</Typography>
								{paymentSuccess ? (
									<>
										<Box mt={5} ml={3}>
											<Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
												Your order number is #10-3103-{orderNumber}.
											</Typography>
										</Box>
										<Box mt={5} ml={3}>
											<Typography variant="subtitle1" sx={{ fontStyle: "italic" }}>
												* Please note that we have not emailed an order confirmation,
												<br />
												and will not be sending you any updates, such as when an
												<br />
												order has shipped, as this is not a live store.
											</Typography>
										</Box>
									</>
								) : (
									<Button variant="contained" onClick={handleBack}>
										Go back and try again
									</Button>
								)}
							</Box>
						</>
					) : (
						<form onSubmit={methods.handleSubmit(handleNext)}>
							{getStepContent(activeStep)}
							<Box sx={{ display: "flex", justifyContent: "flex-end" }}>
								{activeStep !== 0 && (
									<Button onClick={handleBack} sx={{ mt: 3, ml: 1 }}>
										Back
									</Button>
								)}
								<LoadingButton
									loading={loading}
									disabled={submitDisabled()}
									variant="contained"
									type="submit"
									sx={{ mt: 3, ml: 1 }}
								>
									{activeStep === steps.length - 1 ? "Place order" : "Next"}
								</LoadingButton>
							</Box>
						</form>
					)}
				</>
			</Paper>
		</FormProvider>
	);
}

/*
----- v1 -----

	const handleNext = async (data: FieldValues) => {
		const { nameOnCard, saveAddress, ...shippingAddress } = data;

		if (activeStep === steps.length - 1) {
			setLoading(true);
			try {
				const orderNumber = await agent.Orders.create({ saveAddress, shippingAddress });
				setOrderNumber(orderNumber);
				setActiveStep(activeStep + 1);
				dispatch(clearBasket());
				setLoading(false);
			} catch (error) {
				console.log("handleNext: ", error);
				setLoading(false);
			}
		} else {
			setActiveStep(activeStep + 1);
		}
	};
	
*/
