import sys
print("Python:", sys.version)
try:
    from app.main import app
    print("SUCCESS: App loaded cleanly!")
except Exception as e:
    import traceback
    traceback.print_exc()
