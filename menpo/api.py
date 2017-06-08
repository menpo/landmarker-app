from flask import Flask, request
from functools import partial
import os
import json

import menpo
import menpo.io as mio
from menpofit.aam import HolisticAAM, LucasKanadeAAMFitter, WibergInverseCompositional
from menpo.feature import igo

app = Flask(__name__)


def landmark_resolver(group_name, image_path):
    return {group_name: '{}_{}.ljson'.format(os.path.splitext(str(image_path))[0], group_name)}


# method to load images
def load_images(image_paths, group_name):
    images = []
    # load landmarked images
    for image_path in image_paths:
        image = mio.import_image(image_path, landmark_resolver=partial(landmark_resolver, group_name))

        # crop image
        image = image.crop_to_landmarks_proportion(0.1)

        # convert it to grayscale if needed
        if image.n_channels == 3:
            image = image.as_greyscale(mode='luminosity')

        images.append(image)
    return images


def model_path_from_model_folder(path):
    return '{}{}'.format(path, 'aam.pkl')


def loadAAM(model_path):
    return mio.import_pickle(model_path)


def saveAAM(aam, model_path):
    mio.export_pickle(aam, model_path, overwrite=True)


@app.route('/')
def base():
    # TODO delete AAM file
    return 'hello'


# json keys:
# fpath: string
# paths: string[]
# group: string
@app.route('/build_aam', methods=['POST'])
def build_aam():
    json_in = request.get_json()
    training_images = load_images(json_in['paths'], json_in['group'])
    model_path = model_path_from_model_folder(json_in['fpath'])
    if os.path.isfile(model_path):
        aam = loadAAM(model_path)
        aam.increment(training_images)
        saveAAM(aam, model_path)
    else:
        aam = HolisticAAM(training_images, group=json_in['group'], verbose=False, holistic_features=igo,
                          diagonal=120, scales=(0.5, 1.0))
        saveAAM(aam, model_path)
    return ''


# json keys:
# fpath: string
#
# must be called after build_aam
# note: shape is not scaled
# returns json object with 'points' keys
@app.route('/get_mean_shape', methods=['POST'])
def get_mean_shape():
    model_folder = request.get_json()['fpath']
    model_path = model_path_from_model_folder(model_folder)
    aam = loadAAM(model_path)
    mean_shape = aam.reference_shape
    return json.dumps(mean_shape.tojson())


# json keys:
# fpath: string
# path: string
# ljsonpath: string
# group: string
#
# returns json object with 'points' keys
@app.route('/get_fit', methods=['POST'])
def get_fit():
    json_in = request.get_json()
    model_folder = json_in['fpath']
    image_path = json_in['path']
    shape = mio.import_landmark_file(json_in['ljsonpath'])
    group_name = json_in['group']
    model_path = model_path_from_model_folder(model_folder)
    aam = loadAAM(model_path)
    fitter = LucasKanadeAAMFitter(aam, lk_algorithm_cls=WibergInverseCompositional,
                                  n_shape=[3, 20], n_appearance=[30, 150])
    image = mio.import_image(image_path, landmark_resolver=partial(landmark_resolver, group_name))
    fr = fitter.fit_from_shape(image, shape)
    return json.dumps(fr.final_shape.tojson())


def parse_port():
    port = 5001
    try:
        port = int(sys.argv[1])
    except Exception as e:
        pass
    return '{}'.format(port)


def main():
    app.run(host='127.0.0.1', port=parse_port())


if __name__ == '__main__':
    main()
