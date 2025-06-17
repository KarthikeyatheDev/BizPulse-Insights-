# backend/ai_utils.py

# You can comment out or remove all Vertex AI related imports
# (vertexai, GenerativeModel, GenerationConfig, TextGenerationModel, service_account)
# if you're not using them at all anymore.
import os
import traceback # Keep traceback for general error logging if needed

# You won't need the KEY_PATH or credentials setup anymore for a dummy response.
# You can comment out or remove these lines as well:
# KEY_PATH = r"E:\\B Tech 1st yr\\Projects\\bizpulse-1\\backend\\vertex-key.json"
# try:
#     credentials = service_account.Credentials.from_service_account_file(KEY_PATH)
# except Exception as e:
#     print(f"Error loading service account credentials: {e}")
#     print("Please ensure 'vertex-key.json' is in the backend folder and its path is correct.")
#     credentials = None

# if credentials:
#     vertexai.init(
#         project="ai-in-action-project",
#         location="asia-southeast1",
#         credentials=credentials
#     )
# else:
#     print("Vertex AI not initialized due to missing credentials.")

def generate_insight(prompt_text: str) -> str:
    # This function will now always return a dummy response.
    # The 'prompt_text' parameter is still there if you want to
    # use it in your dummy response (e.g., "Insight for: " + prompt_text)
    
    print(f"Generating dummy AI insight for prompt: '{prompt_text}'")
    dummy_insight = "This is a dummy AI insight. The AI model integration is currently disabled."
    
    # You could make it slightly dynamic if you wish:
    # dummy_insight = f"Based on your input '{prompt_text}', here's a simulated AI insight. (AI integration pending)"
    
    return dummy_insight

# You can comment out or remove the __main__ block if you don't need local testing anymore,
# or adapt it to test the dummy response.
# if __name__ == "__main__":
#     # No credentials needed for dummy response test
#     test_prompt = "Tell me about the market trends."
#     try:
#         insight = generate_insight(test_prompt)
#         print(f"\nGenerated Dummy Insight (Test): {insight}")
#     except Exception as e:
#         print(f"\nFailed to generate dummy insight during test: {e}")