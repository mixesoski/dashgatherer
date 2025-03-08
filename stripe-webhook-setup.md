# Stripe Webhook Setup Instructions

## 1. Deploy the Edge Functions to Supabase

1. Navigate to your Supabase project's "Functions" section
2. Replace the existing `stripe-webhook` function with the code from `fix-stripe-webhook.ts`
3. Replace the existing `create-checkout-session` function with the code from `fix-create-checkout-session.ts`
4. Replace the existing `get-subscription-status` function with the code from `fix-get-subscription-status.ts`
5. Deploy all functions

## 2. Create the Subscriptions Table

1. Go to the SQL Editor in your Supabase dashboard
2. Paste the SQL from `create-subscription-table.sql` and run it
3. Verify that the `subscriptions` table was created
4. Note: If you previously had a `user_roles` table, your data will need to be migrated to the `profiles` table's `role` column

## 3. Set Up Environment Variables

Make sure these environment variables are set for your Edge Functions:

- `STRIPE_SECRET_KEY` - Your Stripe Secret API Key
- `STRIPE_WEBHOOK_SECRET` - Your Stripe Webhook Secret
- `STRIPE_ATHLETE_PRICE_ID` - The Price ID for your athlete subscription plan
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key

## 4. Configure the Webhook in Stripe Dashboard

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com/)
2. Go to Developers > Webhooks
3. Click "Add Endpoint"
4. Enter your webhook URL:
   - Format: `https://<your-supabase-project-id>.functions.supabase.co/stripe-webhook`
   - Example: `https://xyzproject.functions.supabase.co/stripe-webhook`
5. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
6. Click "Add endpoint" to save
7. After creating the webhook, click on it to view details
8. Copy the "Signing Secret" - this is your `STRIPE_WEBHOOK_SECRET`

## 5. Test the Integration

1. Make a test purchase with a test card in Stripe Test Mode
2. Check the Supabase Edge Function logs for any errors
3. Verify that a record was created in the `subscriptions` table
4. Verify that the customer's profile was updated with the correct role

## Troubleshooting

If webhooks aren't being processed:

1. Check the Stripe Dashboard > Developers > Webhooks > Select your webhook endpoint > View webhook attempts
2. Look for any failed webhook deliveries and check the response code
3. Check your Supabase Function logs for errors
4. Verify that all environment variables are set correctly
5. Make sure the webhook URL is publicly accessible
6. Ensure the Stripe webhook secret matches the one in your Edge Function

## Common Issues

- **Incorrect Webhook Secret**: Double-check your `STRIPE_WEBHOOK_SECRET` value
- **Missing Environment Variables**: Ensure all required env vars are set
- **Webhook URL Not Accessible**: Verify the URL is publicly accessible
- **Database Errors**: Check if the subscriptions table exists and has the correct schema
- **Different Stripe API Versions**: Make sure your Stripe API version in the code matches your account
- **"relation user_roles does not exist"**: This means your app is still trying to use the old table structure. Make sure to deploy the fixed get-subscription-status function. 