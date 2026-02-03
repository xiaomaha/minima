import os
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
        "python manage.py create_roles",
        "python manage.py opensearch index create --force --ignore-error",
        "python manage.py create_platform_partner",
        "python manage.py create_base_policies",
        "python manage.py load_ncs_data",
    ]

    subprocess.run(["docker", "compose", "exec", "minima", "sh", "-c", " && ".join(commands)])
    subprocess.run(["docker", "compose", "restart", "minima", "worker"])


@app.command()
def demo():
    commands = ["python manage.py setup_demo_data"]

    subprocess.run(["docker", "compose", "exec", "minima", "sh", "-c", " && ".join(commands)])


@app.command()
def lint():
    subprocess.run(["pyrefly", "check"])
    subprocess.run(["ruff", "check", "."])
    subprocess.run(["ruff", "check", "--select", "I", "."])
    subprocess.run(["ruff", "format", "."])


@app.command()
def build_ua_parser():
    BASE_DIR = Path(__file__).resolve().parent
    WHEELS_DIR = BASE_DIR / "wheels"
    WHEELS_DIR.mkdir(parents=True, exist_ok=True)

    packages = ["ua-parser[regex]"]
    platforms = ["linux/amd64", "linux/arm64"]

    for platform in platforms:
        print(f"Building wheels for {platform}...")
        subprocess.run([
            "docker",
            "run",
            "--rm",
            "--platform",
            platform,
            "-v",
            f"{WHEELS_DIR}:/wheels",
            "-w",
            "/tmp",
            "python:3.14-alpine",
            "sh",
            "-c",
            f"apk add --no-cache gcc musl-dev binutils git && pip wheel --wheel-dir /wheels {' '.join(packages)}",
        ])

    print(f"\nWheels built in {WHEELS_DIR}")


UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY")


@app.command()
def download_images():
    BASE_DIR = Path(__file__).resolve().parent
    DEMO_DIR = BASE_DIR / "demo"
    DEMO_DIR.mkdir(parents=True, exist_ok=True)

    for subdir in ["thumbnail", "avatar"]:
        (DEMO_DIR / subdir).mkdir(exist_ok=True)

    print("Fetching images from Unsplash API...")

    thumbnail_images = requests.get(
        "https://api.unsplash.com/search/photos",
        params={"query": "education school computer", "per_page": 50},
        headers={"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"},
    ).json()["results"]

    avatar_images = requests.get(
        "https://api.unsplash.com/search/photos",
        params={"query": "face person", "per_page": 50},
        headers={"Authorization": f"Client-ID {UNSPLASH_ACCESS_KEY}"},
    ).json()["results"]

    def download_one(args):
        image_data, prefix, size = args
        img_id = image_data["id"]
        img_path = DEMO_DIR / prefix / f"{prefix}_{img_id}.jpg"

        if img_path.exists():
            return True

        try:
            download_url = image_data["urls"]["raw"]
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

    tasks = [(img, "thumbnail", "800x600") for img in thumbnail_images] + [
        (img, "avatar", "200x200") for img in avatar_images
    ]

    print(f"Downloading images to {DEMO_DIR}...")

    with ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(download_one, tasks))

    print(f"\nDownloaded {sum(results)}/{len(tasks)} images")


if __name__ == "__main__":
    app()
