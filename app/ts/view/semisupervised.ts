import * as _ from 'underscore'
import * as Backbone from 'backbone'
import * as $ from 'jquery'

import * as Notification from '../../../landmarker.io/src/ts/app/view/notification'
import { randomString } from '../../../landmarker.io/src/ts/app/lib/utils'

export const MinimumTrainingAssetsView = Backbone.View.extend({

    el: '#minimumTrainingAssets',

    events: {
        click: "handleClick"
    },

    initialize: function () {
        _.bindAll(this, 'render')
        this.listenTo(this.model, "change:minimumTrainingAssets", this.render)
        this.render()
    },

    render: function () {
        this.$el.find('.content').html(this.model.minimumTrainingAssets)
        return this
    },

    handleClick: function () {

        if (!this._input) {
            this._oldHtml = this.$el.find('.content').html()
            this._input = randomString(8)
            this.$el.find('.content')
                    .html(`<input type='text' id="${this._input}"/>`)
            this.$el.find(`input`).focus()

            $(window).on('keydown', _.throttle((evt) => {
                if (evt.target.id !== this._input) {
                    return
                }

                if (evt.which === 27) { // ESC
                    this._input = undefined
                    this.$el.find('.content').html(this._oldHtml)
                    evt.stopPropagation()
                    evt.preventDefault()
                } else if (evt.which === 13) { // Enter
                    const input = this.$el.find(`input`)
                    const value = input.val()
                    input.remove()
                    this.changeValue(value)
                    this._input = undefined
                    evt.stopPropagation()
                    evt.preventDefault()
                }
            }, 300))
        }

    },

    changeValue: function (newValue) {

        if (!newValue || newValue === '') {
            return null // ESC key or empty prompt, do nothing
        }

        if (isNaN(newValue)) {
            this.$el.find('.content').html(this._oldHtml || '')
            return new Notification.BaseNotification({
                msg: 'Enter a valid Number', type: 'error'})
        }

        newValue = Number(newValue)

        if (newValue <= 0) {
            this.$el.find('.content').html(this._oldHtml || '')
            return Notification.notify({
                msg: 'Cannot select asset ' + newValue + ' (out of bounds)',
                type: 'error'
            })
        }

        if (newValue !== this.model.minimumTrainingAssets) {
            this.model.minimumTrainingAssets = newValue
        } else {
            this.$el.find('.content').html(this._oldHtml || '')
        }
    }
})

export const AutomaticAnnotationIntervalView = Backbone.View.extend({

    el: '#automaticAnnotationInterval',

    events: {
        click: "handleClick"
    },

    initialize: function () {
        _.bindAll(this, 'render')
        this.listenTo(this.model, "change:automaticAnnotationInterval", this.render)
        this.render()
    },

    render: function () {
        this.$el.find('.content').html(this.model.automaticAnnotationInterval)
        return this
    },

    handleClick: function () {

        if (!this._input) {
            this._oldHtml = this.$el.find('.content').html()
            this._input = randomString(8)
            this.$el.find('.content')
                    .html(`<input type='text' id="${this._input}"/>`)
            this.$el.find(`input`).focus()

            $(window).on('keydown', _.throttle((evt) => {
                if (evt.target.id !== this._input) {
                    return
                }

                if (evt.which === 27) { // ESC
                    this._input = undefined
                    this.$el.find('.content').html(this._oldHtml)
                    evt.stopPropagation()
                    evt.preventDefault()
                } else if (evt.which === 13) { // Enter
                    const input = this.$el.find(`input`)
                    const value = input.val()
                    input.remove()
                    this.changeValue(value)
                    this._input = undefined
                    evt.stopPropagation()
                    evt.preventDefault()
                }
            }, 300))
        }

    },

    changeValue: function (newValue) {

        if (!newValue || newValue === '') {
            return null // ESC key or empty prompt, do nothing
        }

        if (isNaN(newValue)) {
            this.$el.find('.content').html(this._oldHtml || '')
            return new Notification.BaseNotification({
                msg: 'Enter a valid Number', type: 'error'})
        }

        newValue = Number(newValue)

        if (newValue <= 0) {
            this.$el.find('.content').html(this._oldHtml || '')
            return Notification.notify({
                msg: 'Cannot select asset ' + newValue + ' (out of bounds)',
                type: 'error'
            })
        }

        if (newValue !== this.model.automaticAnnotationInterval) {
            this.model.automaticAnnotationInterval = newValue
        } else {
            this.$el.find('.content').html(this._oldHtml || '')
        }
    }
})
