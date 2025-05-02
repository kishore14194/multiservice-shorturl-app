# Use official Python image as base
FROM python:3.9-slim

# Set the working directory
WORKDIR /app

# Copy the requirements file
COPY requirements.txt .

# Install the dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

#RUN chmod +x wait-for-it.sh

# Expose the backend port
EXPOSE 8000

# Run the FastAPI app
#CMD ["./wait-for-it.sh", "mysql:3306", "--", "uvicorn", "generate_short_url:app", "--host", "0.0.0.0", "--port", "8000"]
CMD ["uvicorn", "generate_short_url:app", "--host", "0.0.0.0", "--port", "8000"]