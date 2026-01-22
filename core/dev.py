import subprocess
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path

import requests
import typer
from PIL import Image

app = typer.Typer()


@app.command()
def up():
    subprocess.run(["docker", "build", "--target", "dev", "-t", "minima:dev", "."])
    subprocess.run(["docker", "build", "-t", "minima-search:dev", "-f", "Dockerfile.search", "."])
    subprocess.run(["docker", "network", "create", "minima"])
    subprocess.run(["docker", "compose", "up", "-d"])


@app.command()
def bootstrap():
    commands = [
        "python manage.py migrate",
        "python manage.py collectstatic --noinput",
        "python manage.py createsuperuser --noinput || true",
        "python manage.py create_assistant_bot",
        "python manage.py opensearch index create --force --ignore-error",
        "python manage.py create_platform_partner",
        "python manage.py create_base_policies",
        "python manage.py convert_mjml",
        "python manage.py load_ncs_data",
    ]

    subprocess.run(["docker", "compose", "exec", "minima", "sh", "-c", " && ".join(commands)])
    subprocess.run(["docker", "compose", "restart", "minima", "worker"])


@app.command()
def lint():
    subprocess.run(["ty", "check"])
    subprocess.run(["ruff", "check", "."])
    subprocess.run(["ruff", "check", "--select", "I", "."])
    subprocess.run(["ruff", "format", "."])


@app.command()
def download_images():
    BASE_DIR = Path(__file__).resolve().parent
    CACHE_DIR = BASE_DIR / ".cache" / "test_images"
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    print("Fetching image list from Picsum API...")
    response = requests.get("https://picsum.photos/v2/list?page=1&limit=100")
    images = response.json()

    def download_one(args):
        image_data, prefix, size = args
        img_id = image_data["id"]
        img_path = CACHE_DIR / f"{prefix}_{img_id}.jpg"

        if img_path.exists():
            return True

        try:
            download_url = image_data["download_url"]
            img_response = requests.get(download_url, timeout=30)
            if img_response.status_code == 200:
                img = Image.open(BytesIO(img_response.content))
                width, height = map(int, size.split("x"))
                img.thumbnail((width, height), Image.Resampling.LANCZOS)
                img = img.convert("RGB")
                img.save(img_path, "JPEG", quality=85, optimize=True)
                print(f"✓ {prefix}_{img_id}.jpg")
                return True
        except Exception as e:
            print(f"✗ {prefix}_{img_id}: {e}")
        return False

    tasks = [(img, "thumb", "800x600") for img in images[:100]] + [(img, "avatar", "200x200") for img in images[:100]]

    print(f"Downloading images to {CACHE_DIR}...")

    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(download_one, tasks))

    print(f"\nDownloaded {sum(results)}/{len(tasks)} images")


if __name__ == "__main__":
    app()
